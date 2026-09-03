'use strict';
const pool = require('../config/db');

const VENDEDOR_WEB_ID = 'US0002'; // Arley — vendedor asignado a pedidos de lilop.store

const TAMANIOS_VALIDOS = ['Sencillo', 'Doble', 'Queen', 'King', 'Unico', 'Semidoble'];

const MAPA_MEDIO_PAGO = {
  mercadopago: 'Mercado Pago',
  transfer:    'Transferencia',
  whatsapp:    'Contraentrega',
};

/** Extrae el tamaño válido desde el string variant, ej: "Tamaño: Queen" -> "Queen" */
function extraerTamanio(variant) {
  if (!variant) return null;
  const encontrado = TAMANIOS_VALIDOS.find(t => variant.includes(t));
  return encontrado || null;
}

/** Fecha mínima de entrega: hoy+3 días calendario (independiente del día de la semana) */
function getMinFechaEntrega() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 3);
  return d.toISOString().split('T')[0];
}

const crearPedidoPublico = async (req, res) => {
  const {
    firstName, lastName, email, phone,
    city, department, localidad, address, neighborhood, apartment, notes,
    paymentMethod, items, deliveryDate,
  } = req.body;

  if (!firstName || !lastName || !email || !phone || !department || !city ||
      !localidad || !neighborhood || !address || !apartment) {
    return res.status(400).json({ error: 'Faltan campos obligatorios del cliente' });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });
  }
  if (!deliveryDate) {
    return res.status(400).json({ error: 'La fecha de entrega es obligatoria' });
  }
  const minFechaEntrega = getMinFechaEntrega();
  if (deliveryDate < minFechaEntrega) {
    return res.status(400).json({ error: `La fecha de entrega debe ser ${minFechaEntrega} o posterior (mínimo 3 días después de la compra)` });
  }

  const medioPagoNombre = MAPA_MEDIO_PAGO[paymentMethod] || 'Por confirmar';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /* 1. Cliente: reutilizar por celular si ya existe, si no crear */
    const nombreCompleto = `${firstName} ${lastName}`.trim();
    let clienteId;
    const existente = await client.query('SELECT id FROM clientes WHERE celular = $1', [phone]);
    if (existente.rows.length) {
      clienteId = existente.rows[0].id;
      await client.query(
        `UPDATE clientes SET
           ciudad = COALESCE($1, ciudad), departamento = COALESCE($2, departamento),
           direccion = COALESCE($3, direccion), barrio = COALESCE($4, barrio),
           localidad = COALESCE($5, localidad)
         WHERE id = $6`,
        [city || null, department || null, address || null, neighborhood || null, localidad || null, clienteId]
      );
    } else {
      const nuevoCliente = await client.query(
        `INSERT INTO clientes (nombre, celular, ciudad, departamento, localidad, direccion, barrio, origen_venta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [nombreCompleto, phone, city, department, localidad, address, neighborhood, 'Lilop.store']
      );
      clienteId = nuevoCliente.rows[0].id;
    }

    /* 2. Medio de pago */
    const mp = await client.query('SELECT id FROM medios_pago WHERE nombre = $1', [medioPagoNombre]);
    const medioPagoId = mp.rows[0]?.id || null;

    /* 3. Notas: incluir email + apartamento + notas del cliente, ya que no tienen columna propia */
    const notasCompletas = [
      `Email: ${email || 'no proporcionado'}`,
      apartment ? `Apto/Interior: ${apartment}` : null,
      notes ? `Notas del cliente: ${notes}` : null,
    ].filter(Boolean).join(' | ');

    /* 4. Pedido */
    const pedido = await client.query(
      `INSERT INTO pedidos (cliente_id, vendedor_id, medio_pago_id, estado, estado_pago, origen, notas, valor_domicilio, fecha_entrega)
       VALUES ($1, $2, $3, 'por_confirmar', 'pendiente', 'Lilop.store', $4, 0, $5)
       RETURNING id`,
      [clienteId, VENDEDOR_WEB_ID, medioPagoId, notasCompletas, deliveryDate]
    );
    const pedidoId = pedido.rows[0].id;

    /* 5. Productos del pedido */
    for (const item of items) {
      const tamanio = extraerTamanio(item.variant);
      await client.query(
        `INSERT INTO productos (pedido_id, nombre, tamanio, diseno, valor_venta_override, cantidad)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [pedidoId, item.name, tamanio, item.design || null, item.price * (item.quantity || 1), item.quantity || 1]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, pedido_id: pedidoId, cliente_id: clienteId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear pedido público:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

module.exports = { crearPedidoPublico };
