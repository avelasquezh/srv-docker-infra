const BaseRepository = require('../../core/BaseRepository');

class ClienteRepository extends BaseRepository {
  async listar() {
    const { rows } = await this.query(`
      SELECT
        c.*,
        COUNT(DISTINCT p.id)::int AS total_pedidos,
        COALESCE((
          SELECT SUM(pr.valor_venta_override)
          FROM pedidos p2
          JOIN productos pr ON pr.pedido_id = p2.id
          WHERE p2.cliente_id = c.id
            AND pr.valor_venta_override IS NOT NULL
        ), 0) AS total_gastado
      FROM clientes c
      LEFT JOIN pedidos p ON p.cliente_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    return rows;
  }

  async obtenerPorId(id) {
    const { rows } = await this.query('SELECT * FROM clientes WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async celularEnUso(celular, excluirId) {
    const { rows } = await this.query('SELECT id FROM clientes WHERE celular = $1 AND id != $2', [celular, excluirId]);
    return rows.length > 0;
  }

  async crear({ nombre, celular, departamento, ciudad, localidad, barrio, direccion, origenVenta }) {
    const { rows } = await this.query(
      `INSERT INTO clientes (nombre, celular, departamento, ciudad, localidad, barrio, direccion, origen_venta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [nombre, celular || null, departamento || null, ciudad || null, localidad || null, barrio || null, direccion || null, origenVenta || null]
    );
    return rows[0];
  }

  async actualizar(id, { nombre, celular, departamento, ciudad, localidad, barrio, direccion, origenVenta }) {
    const { rows } = await this.query(
      `UPDATE clientes SET
         nombre = COALESCE($1, nombre), celular = COALESCE($2, celular),
         departamento = COALESCE($3, departamento), ciudad = COALESCE($4, ciudad),
         localidad = COALESCE($5, localidad), barrio = COALESCE($6, barrio),
         direccion = COALESCE($7, direccion), origen_venta = COALESCE($8, origen_venta),
         updated_at = now()
       WHERE id = $9 RETURNING *`,
      [nombre, celular, departamento, ciudad, localidad, barrio, direccion, origenVenta, id]
    );
    return rows[0] || null;
  }

  async tienePedidos(id) {
    const { rows } = await this.query('SELECT id FROM pedidos WHERE cliente_id = $1 LIMIT 1', [id]);
    return rows.length > 0;
  }

  async eliminar(id) {
    const { rows } = await this.query('DELETE FROM clientes WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  }

  async pedidosDe(id) {
    const { rows } = await this.query('SELECT * FROM pedidos WHERE cliente_id = $1 ORDER BY fecha_venta DESC', [id]);
    return rows;
  }

  async listaOrigenes() {
    const { rows } = await this.query('SELECT nombre FROM origenes_venta ORDER BY nombre');
    return rows.map((r) => r.nombre);
  }
}

module.exports = ClienteRepository;
