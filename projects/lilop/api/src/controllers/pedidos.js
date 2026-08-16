const pool = require('../config/db');

const listar = async (req, res) => {
  try {
    const { estado, vendedor_id, cliente_id, desde, hasta } = req.query;
    let query = 'SELECT * FROM v_pedidos_resumen WHERE 1=1';
    const params = [];
    let i = 1;

    if (estado)      { query += ` AND estado = $${i++}`;       params.push(estado); }
    if (vendedor_id) { query += ` AND vendedor_id = $${i++}`;  params.push(vendedor_id); }
    if (cliente_id)  { query += ` AND cliente_id = $${i++}`;   params.push(cliente_id); }
    if (desde)       { query += ` AND fecha_venta >= $${i++}`; params.push(desde); }
    if (hasta)       { query += ` AND fecha_venta <= $${i++}`; params.push(hasta); }

    query += ' ORDER BY fecha_venta DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar pedidos:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const obtener = async (req, res) => {
  const { id } = req.params;
  try {
    const pedido = await pool.query(
      'SELECT * FROM v_pedidos_resumen WHERE id = $1',
      [id]
    );
    if (pedido.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const productos = await pool.query(
      `SELECT pr.*,
        cp.precio AS valor_venta,
        json_agg(
          json_build_object('concepto', c.concepto, 'valor', c.valor_total)
          ORDER BY c.created_at
        ) FILTER (WHERE c.id IS NOT NULL) AS compras
       FROM productos pr
       LEFT JOIN catalogo_productos cat ON cat.nombre = pr.nombre
       LEFT JOIN catalogo_precios cp ON cp.catalogo_id = cat.id AND cp.tamanio = pr.tamanio
       LEFT JOIN compras c ON c.producto_id = pr.id
       WHERE pr.pedido_id = $1
       GROUP BY pr.id, cp.precio
       ORDER BY pr.created_at`,
      [id]
    );

    res.json({
      ...pedido.rows[0],
      productos: productos.rows,
    });
  } catch (err) {
    console.error('Error al obtener pedido:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crear = async (req, res) => {
  const {
    cliente_id, vendedor_id, fecha_entrega, valor_venta,
    valor_domicilio, domiciliario, medio_pago, estado, notas
  } = req.body;

  if (!cliente_id || !vendedor_id || valor_venta === undefined || valor_venta === null) {
    return res.status(400).json({ error: 'cliente_id, vendedor_id y valor_venta son requeridos' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO pedidos
         (cliente_id, vendedor_id, fecha_entrega, valor_venta,
          valor_domicilio, domiciliario, medio_pago, estado, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        cliente_id, vendedor_id, fecha_entrega || null,
        valor_venta, valor_domicilio || 0,
        domiciliario || null, medio_pago || null,
        estado || 'pendiente', notas || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear pedido:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizar = async (req, res) => {
  const { id } = req.params;
  const {
    fecha_entrega, valor_venta, valor_domicilio,
    domiciliario, medio_pago, estado, notas, vendedor_id
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE pedidos
       SET fecha_entrega   = COALESCE($1,  fecha_entrega),
           valor_venta     = COALESCE($2,  valor_venta),
           valor_domicilio = COALESCE($3,  valor_domicilio),
           domiciliario    = COALESCE($4,  domiciliario),
           medio_pago      = COALESCE($5,  medio_pago),
           estado          = COALESCE($6,  estado),
           notas           = COALESCE($7,  notas),
           vendedor_id     = COALESCE($8,  vendedor_id)
       WHERE id = $9
       RETURNING *`,
      [fecha_entrega, valor_venta, valor_domicilio,
       domiciliario, medio_pago, estado, notas, vendedor_id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar pedido:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const cambiarEstado = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!estado) {
    return res.status(400).json({ error: 'El estado es requerido' });
  }

  try {
    const result = await pool.query(
      'UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING id, estado',
      [estado, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al cambiar estado:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM pedidos WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    res.json({ mensaje: 'Pedido eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar pedido:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, eliminar };
