const BaseRepository = require('../../core/BaseRepository');

/**
 * CategoriaRepository — dedicado porque `categorias` tiene columnas
 * (`slug`, `activo`) y una operación (`actualizar`) que los catálogos
 * simples no tienen. No comparte clase con CatalogoSimpleRepository
 * a propósito.
 */
class CategoriaRepository extends BaseRepository {
  async listar() {
    const { rows } = await this.query('SELECT * FROM categorias ORDER BY nombre');
    return rows;
  }

  async crear(nombre, slug, tipo) {
    const { rows } = await this.query(
      'INSERT INTO categorias (nombre, slug, tipo) VALUES ($1, $2, $3) RETURNING *',
      [nombre, slug, tipo || 'linea_producto']
    );
    return rows[0];
  }

  async actualizar(id, { nombre, slug, activo, tipo }) {
    const { rows } = await this.query(
      `UPDATE categorias SET
        nombre = COALESCE($1, nombre),
        slug   = COALESCE($2, slug),
        activo = COALESCE($3, activo),
        tipo   = COALESCE($4, tipo)
       WHERE id = $5 RETURNING *`,
      [nombre ?? null, slug ?? null, activo ?? null, tipo ?? null, id]
    );
    return rows[0] || null;
  }

  async eliminar(id) {
    await this.query('DELETE FROM categorias WHERE id = $1', [id]);
  }
}

module.exports = CategoriaRepository;
