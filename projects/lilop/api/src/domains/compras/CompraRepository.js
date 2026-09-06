const BaseRepository = require('../../core/BaseRepository');

class CompraRepository extends BaseRepository {
  async listarPorProducto(productoId) {
    const { rows } = await this.query('SELECT * FROM compras WHERE producto_id = $1 ORDER BY created_at', [productoId]);
    return rows;
  }

  async obtenerPorId(id) {
    const { rows } = await this.query('SELECT * FROM compras WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async productoExiste(productoId) {
    const { rows } = await this.query('SELECT id FROM productos WHERE id = $1', [productoId]);
    return rows.length > 0;
  }

  async crear(productoId, { concepto, diseno, proveedor, cantidad, valorUnitario, fechaCompra, estado }) {
    const { rows } = await this.query(
      `INSERT INTO compras (producto_id, concepto, diseno, proveedor, cantidad, valor_unitario, fecha_compra, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [productoId, concepto || null, diseno || null, proveedor || null, cantidad, valorUnitario, fechaCompra || null, estado || 'Pendiente']
    );
    return rows[0];
  }

  async actualizar(id, { concepto, diseno, proveedor, cantidad, valorUnitario, fechaCompra, estado }) {
    const { rows } = await this.query(
      `UPDATE compras SET
         concepto = COALESCE($1, concepto), diseno = COALESCE($2, diseno),
         proveedor = COALESCE($3, proveedor), cantidad = COALESCE($4, cantidad),
         valor_unitario = COALESCE($5, valor_unitario), fecha_compra = COALESCE($6, fecha_compra),
         estado = COALESCE($7, estado)
       WHERE id = $8 RETURNING *`,
      [concepto, diseno, proveedor, cantidad, valorUnitario, fechaCompra, estado, id]
    );
    return rows[0] || null;
  }

  async eliminar(id) {
    const { rows } = await this.query('DELETE FROM compras WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  }
}

module.exports = CompraRepository;
