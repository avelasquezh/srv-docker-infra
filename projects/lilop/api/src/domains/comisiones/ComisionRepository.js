const BaseRepository = require('../../core/BaseRepository');

class ComisionRepository extends BaseRepository {
  async listar({ vendedorId, estado } = {}) {
    let sql = `
      SELECT c.*, u.nombre AS vendedor, p.valor_venta, p.estado AS estado_pedido
      FROM comisiones c
      JOIN usuarios u ON u.id = c.vendedor_id
      JOIN pedidos  p ON p.id = c.pedido_id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;
    if (vendedorId) { sql += ` AND c.vendedor_id = $${i++}`; params.push(vendedorId); }
    if (estado)     { sql += ` AND c.estado = $${i++}`;      params.push(estado); }
    sql += ' ORDER BY c.created_at DESC';
    const { rows } = await this.query(sql, params);
    return rows;
  }

  async obtenerPorId(id) {
    const { rows } = await this.query(
      `SELECT c.*, u.nombre AS vendedor, p.valor_venta, p.estado AS estado_pedido
       FROM comisiones c
       JOIN usuarios u ON u.id = c.vendedor_id
       JOIN pedidos  p ON p.id = c.pedido_id
       WHERE c.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async cambiarEstado(id, estado) {
    const { rows } = await this.query(
      `UPDATE comisiones SET estado = $1 WHERE id = $2 RETURNING id, estado, valor_comision`,
      [estado, id]
    );
    return rows[0] || null;
  }

  async resumenPorVendedor(vendedorId) {
    const { rows } = await this.query(
      `SELECT
         COUNT(*) AS total_comisiones,
         SUM(valor_comision) AS total_valor,
         SUM(CASE WHEN estado = 'Pendiente' THEN valor_comision ELSE 0 END) AS pendiente,
         SUM(CASE WHEN estado = 'Pagada'    THEN valor_comision ELSE 0 END) AS pagado
       FROM comisiones WHERE vendedor_id = $1`,
      [vendedorId]
    );
    return rows[0];
  }
}

module.exports = ComisionRepository;
