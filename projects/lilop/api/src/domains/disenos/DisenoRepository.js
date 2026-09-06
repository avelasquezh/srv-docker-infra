const BaseRepository = require('../../core/BaseRepository');

class DisenoRepository extends BaseRepository {
  async listar(catalogoId) {
    let sql = `
      SELECT d.id, d.nombre, d.catalogo, d.imagen, d.estado, d.created_at,
             COALESCE(array_agg(dcp.catalogo_id) FILTER (WHERE dcp.catalogo_id IS NOT NULL), '{}') AS catalogo_ids
      FROM disenos d
      LEFT JOIN disenos_catalogo_productos dcp ON dcp.diseno_id = d.id
    `;
    const params = [];
    if (catalogoId) {
      sql += ` WHERE d.id IN (SELECT diseno_id FROM disenos_catalogo_productos WHERE catalogo_id = $1)`;
      params.push(catalogoId);
    }
    sql += ' GROUP BY d.id ORDER BY d.created_at DESC';
    const { rows } = await this.query(sql, params);
    return rows;
  }

  async crear({ nombre, catalogo, imagen, estado }) {
    const { rows } = await this.query(
      `INSERT INTO disenos (nombre, catalogo, imagen, estado)
       VALUES ($1, $2, $3, $4) RETURNING id, nombre, catalogo, imagen, estado, created_at`,
      [nombre, catalogo || 'adulto_diseno', imagen || null, estado || 'Disponible']
    );
    return rows[0];
  }

  async actualizar(id, { nombre, catalogo, imagen, estado }) {
    const { rows } = await this.query(
      `UPDATE disenos SET
         nombre = COALESCE($1, nombre), catalogo = COALESCE($2, catalogo),
         imagen = COALESCE($3, imagen), estado = COALESCE($4, estado), updated_at = now()
       WHERE id = $5 RETURNING id, nombre, catalogo, imagen, estado, created_at`,
      [nombre || null, catalogo || null, imagen || null, estado || null, id]
    );
    return rows[0] || null;
  }

  async eliminar(id) {
    const { rows } = await this.query('DELETE FROM disenos WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  }

  async listarProductos(disenoId) {
    const { rows } = await this.query(
      `SELECT cp.id, cp.nombre FROM disenos_catalogo_productos dcp
       JOIN catalogo_productos cp ON cp.id = dcp.catalogo_id
       WHERE dcp.diseno_id = $1 ORDER BY cp.nombre`,
      [disenoId]
    );
    return rows;
  }

  async reemplazarProductos(disenoId, catalogoIds) {
    await this.query('DELETE FROM disenos_catalogo_productos WHERE diseno_id = $1', [disenoId]);
    if (catalogoIds.length) {
      const values = catalogoIds.map((_, i) => `($1, $${i + 2})`).join(',');
      await this.query(
        `INSERT INTO disenos_catalogo_productos (diseno_id, catalogo_id) VALUES ${values}`,
        [disenoId, ...catalogoIds]
      );
    }
  }
}

module.exports = DisenoRepository;
