const BaseRepository = require('../../core/BaseRepository');

class EntregaRepository extends BaseRepository {
  async listarPorPedido(pedidoId) {
    const { rows } = await this.query('SELECT * FROM entregas WHERE pedido_id = $1 ORDER BY created_at', [pedidoId]);
    return rows;
  }

  async obtenerPorId(id) {
    const { rows } = await this.query('SELECT * FROM entregas WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async pedidoExiste(pedidoId) {
    const { rows } = await this.query('SELECT id FROM pedidos WHERE id = $1', [pedidoId]);
    return rows.length > 0;
  }

  async crear(pedidoId, { fechaEntrega, valorDomicilio, domiciliario, estado, notas }) {
    const { rows } = await this.query(
      `INSERT INTO entregas (pedido_id, fecha_entrega, valor_domicilio, domiciliario, estado, notas)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [pedidoId, fechaEntrega || null, valorDomicilio || 0, domiciliario || null, estado || 'Pendiente', notas || null]
    );
    return rows[0];
  }

  async actualizar(id, { fechaEntrega, valorDomicilio, domiciliario, estado, notas }) {
    const { rows } = await this.query(
      `UPDATE entregas SET
         fecha_entrega   = COALESCE($1, fecha_entrega),
         valor_domicilio = COALESCE($2, valor_domicilio),
         domiciliario    = COALESCE($3, domiciliario),
         estado          = COALESCE($4, estado),
         notas           = COALESCE($5, notas)
       WHERE id = $6 RETURNING *`,
      [fechaEntrega, valorDomicilio, domiciliario, estado, notas, id]
    );
    return rows[0] || null;
  }

  async eliminar(id) {
    const { rows } = await this.query('DELETE FROM entregas WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  }
}

module.exports = EntregaRepository;
