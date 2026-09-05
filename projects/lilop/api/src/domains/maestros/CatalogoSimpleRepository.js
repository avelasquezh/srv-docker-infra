const BaseRepository = require('../../core/BaseRepository');

/**
 * CatalogoSimpleRepository — repositorio genérico para tablas catálogo
 * con la misma forma exacta (`id`, `nombre`, únicas por nombre):
 * origenes_venta, conceptos_costo, conceptos_compra. Parametrizado por
 * tabla en vez de duplicar la misma clase 3 veces (DRY) — pero
 * `categorias` NO usa esta clase porque tiene columnas y reglas
 * distintas (ver CategoriaRepository): forzarla aquí habría sido un
 * mal uso de la generalización, no una aplicación real de Liskov.
 */
class CatalogoSimpleRepository extends BaseRepository {
  /** @param {import('pg').Pool} pool @param {string} tabla - nombre real de la tabla, ya validado (no viene de input de usuario) */
  constructor(pool, tabla) {
    super(pool);
    this.tabla = tabla;
  }

  async listar() {
    const { rows } = await this.query(`SELECT id, nombre FROM ${this.tabla} ORDER BY nombre`);
    return rows;
  }

  async crear(nombre) {
    const { rows } = await this.query(
      `INSERT INTO ${this.tabla} (nombre) VALUES ($1) RETURNING *`,
      [nombre]
    );
    return rows[0];
  }

  async eliminar(id) {
    await this.query(`DELETE FROM ${this.tabla} WHERE id = $1`, [id]);
  }
}

module.exports = CatalogoSimpleRepository;
