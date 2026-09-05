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

  async crear(nombre, slug) {
    const { rows } = await this.query(
      'INSERT INTO categorias (nombre, slug) VALUES ($1, $2) RETURNING *',
      [nombre, slug]
    );
    return rows[0];
  }

  async actualizar(id, { nombre, slug, activo }) {
    const { rows } = await this.query(
      `UPDATE categorias SET
        nombre = COALESCE($1, nombre),
        slug   = COALESCE($2, slug),
        activo = COALESCE($3, activo)
       WHERE id = $4 RETURNING *`,
      [nombre ?? null, slug ?? null, activo ?? null, id]
    );
    return rows[0] || null;
  }

  async eliminar(id) {
    await this.query('DELETE FROM categorias WHERE id = $1', [id]);
  }
}

module.exports = CategoriaRepository;
