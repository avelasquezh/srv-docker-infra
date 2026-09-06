const BaseRepository = require('../../core/BaseRepository');

const COLUMNAS_PUBLICAS = 'id, nombre, celular, email, rol, comision_pct, activo, created_at';
const COLUMNAS_RETORNO_CRUD = 'id, nombre, celular, email, rol, comision_pct, activo';

/**
 * UsuarioRepository (dominio `usuarios`) — CRUD administrativo de la
 * tabla `usuarios`. Distinto del `UsuarioRepository` del dominio `auth`
 * (login + listado de vendedores): mismo table, bounded context
 * diferente — evita que un solo repositorio termine haciendo de
 * "god class" para dos responsabilidades no relacionadas.
 */
class UsuarioRepository extends BaseRepository {
  async listar() {
    const { rows } = await this.query(
      `SELECT ${COLUMNAS_PUBLICAS} FROM usuarios ORDER BY created_at DESC`
    );
    return rows;
  }

  async obtener(id) {
    const { rows } = await this.query(
      `SELECT ${COLUMNAS_PUBLICAS} FROM usuarios WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async crear({ nombre, celular, email, passwordHash, rol, comisionPct }) {
    const { rows } = await this.query(
      `INSERT INTO usuarios (nombre, celular, email, password, rol, comision_pct)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUMNAS_RETORNO_CRUD}`,
      [nombre, celular || null, email || null, passwordHash, rol || 'vendedor', comisionPct ?? 20]
    );
    return rows[0];
  }

  async actualizar(id, { nombre, celular, email, rol, comisionPct, activo }) {
    const { rows } = await this.query(
      `UPDATE usuarios SET
        nombre       = COALESCE($1, nombre),
        celular      = COALESCE($2, celular),
        email        = COALESCE($3, email),
        rol          = COALESCE($4, rol),
        comision_pct = COALESCE($5, comision_pct),
        activo       = COALESCE($6, activo)
       WHERE id = $7
       RETURNING ${COLUMNAS_RETORNO_CRUD}`,
      [nombre, celular, email, rol, comisionPct, activo, id]
    );
    return rows[0] || null;
  }

  async cambiarPassword(id, passwordHash) {
    const { rows } = await this.query(
      'UPDATE usuarios SET password = $1 WHERE id = $2 RETURNING id',
      [passwordHash, id]
    );
    return rows[0] || null;
  }

  async eliminar(id) {
    const { rows } = await this.query(
      'DELETE FROM usuarios WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] || null;
  }
}

module.exports = UsuarioRepository;
