const BaseRepository = require('../../core/BaseRepository');

const SELECT_CON_OPCIONES = `
  SELECT a.*,
    json_agg(json_build_object('id', o.id, 'nombre', o.nombre, 'valor', o.valor) ORDER BY o.id)
    FILTER (WHERE o.id IS NOT NULL) AS opciones
  FROM atributos a
  LEFT JOIN atributo_opciones o ON o.atributo_id = a.id
`;

class AtributoRepository extends BaseRepository {
  async listar() {
    const { rows } = await this.query(`${SELECT_CON_OPCIONES} GROUP BY a.id ORDER BY a.nombre`);
    return rows;
  }

  async crear({ nombre, tipo, sobreprecio }) {
    const { rows } = await this.query(
      'INSERT INTO atributos (nombre, tipo, sobreprecio) VALUES ($1, $2, $3) RETURNING *',
      [nombre, tipo, sobreprecio]
    );
    return rows[0];
  }

  async actualizar(id, { nombre, sobreprecio, activo }) {
    const { rows } = await this.query(
      `UPDATE atributos SET nombre = COALESCE($1, nombre), sobreprecio = COALESCE($2, sobreprecio), activo = COALESCE($3, activo)
       WHERE id = $4 RETURNING *`,
      [nombre, sobreprecio, activo, id]
    );
    return rows[0] || null;
  }

  async eliminar(id) {
    await this.query('DELETE FROM atributos WHERE id = $1', [id]);
  }

  async crearOpcion(atributoId, { nombre, valor }) {
    const { rows } = await this.query(
      'INSERT INTO atributo_opciones (atributo_id, nombre, valor) VALUES ($1, $2, $3) RETURNING *',
      [atributoId, nombre, valor]
    );
    return rows[0];
  }

  async eliminarOpcion(opcionId) {
    await this.query('DELETE FROM atributo_opciones WHERE id = $1', [opcionId]);
  }

  async listarPorProducto(catalogoId) {
    const { rows } = await this.query(
      `SELECT a.*,
         json_agg(json_build_object('id', o.id, 'nombre', o.nombre, 'valor', o.valor) ORDER BY o.id)
         FILTER (WHERE o.id IS NOT NULL) AS opciones
       FROM atributos a
       JOIN catalogo_atributos ca ON ca.atributo_id = a.id
       LEFT JOIN atributo_opciones o ON o.atributo_id = a.id
       WHERE ca.catalogo_id = $1
       GROUP BY a.id ORDER BY a.nombre`,
      [catalogoId]
    );
    return rows;
  }

  async reemplazarAtributosProducto(catalogoId, atributoIds) {
    await this.query('DELETE FROM catalogo_atributos WHERE catalogo_id = $1', [catalogoId]);
    if (atributoIds.length) {
      const vals = atributoIds.map((_, i) => `($1, $${i + 2})`).join(',');
      await this.query(`INSERT INTO catalogo_atributos (catalogo_id, atributo_id) VALUES ${vals}`, [catalogoId, ...atributoIds]);
    }
  }
}

module.exports = AtributoRepository;
