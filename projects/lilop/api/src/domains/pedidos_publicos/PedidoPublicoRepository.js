const BaseRepository = require('../../core/BaseRepository');

class PedidoPublicoRepository extends BaseRepository {
  async buscarClientePorCelular(client, celular) {
    const { rows } = await client.query('SELECT id FROM clientes WHERE celular = $1', [celular]);
    return rows[0]?.id || null;
  }

  async actualizarCliente(client, id, { city, department, address, neighborhood, localidad }) {
    await client.query(
      `UPDATE clientes SET
         ciudad = COALESCE($1, ciudad), departamento = COALESCE($2, departamento),
         direccion = COALESCE($3, direccion), barrio = COALESCE($4, barrio),
         localidad = COALESCE($5, localidad)
       WHERE id = $6`,
      [city || null, department || null, address || null, neighborhood || null, localidad || null, id]
    );
  }

  async crearCliente(client, { nombreCompleto, phone, city, department, localidad, address, neighborhood }) {
    const { rows } = await client.query(
      `INSERT INTO clientes (nombre, celular, ciudad, departamento, localidad, direccion, barrio, origen_venta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [nombreCompleto, phone, city, department, localidad, address, neighborhood, 'Lilop.store']
    );
    return rows[0].id;
  }

  async obtenerMedioPagoId(client, nombre) {
    const { rows } = await client.query('SELECT id FROM medios_pago WHERE nombre = $1', [nombre]);
    return rows[0]?.id || null;
  }

  async crearPedido(client, { clienteId, vendedorId, medioPagoId, notas, fechaEntrega }) {
    const { rows } = await client.query(
      `INSERT INTO pedidos (cliente_id, vendedor_id, medio_pago_id, estado, estado_pago, origen, notas, valor_domicilio, fecha_entrega)
       VALUES ($1, $2, $3, 'por_confirmar', 'pendiente', 'Lilop.store', $4, 0, $5)
       RETURNING id`,
      [clienteId, vendedorId, medioPagoId, notas, fechaEntrega]
    );
    return rows[0].id;
  }

  async crearProducto(client, pedidoId, { nombre, tamanio, diseno, valorVentaOverride, cantidad }) {
    await client.query(
      `INSERT INTO productos (pedido_id, nombre, tamanio, diseno, valor_venta_override, cantidad)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [pedidoId, nombre, tamanio, diseno, valorVentaOverride, cantidad]
    );
  }
}

module.exports = PedidoPublicoRepository;
