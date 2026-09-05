const BaseRepository = require('../../core/BaseRepository');

/**
 * UsuarioRepository — acceso a datos de la tabla `usuarios` para el
 * dominio auth (login + listado de vendedores). Mismo criterio que
 * el resto de repositorios migrados: no conoce Express ni bcrypt/jwt,
 * solo SQL vía el pool inyectado.
 */
class UsuarioRepository extends BaseRepository {
  /** Usuario activo por email, o null si no existe/está inactivo. */
  async buscarPorEmailActivo(email) {
    const { rows } = await this.query(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = true',
      [email]
    );
    return rows[0] || null;
  }

  /**
   * Usuarios activos, opcionalmente filtrados por rol. Mismo contrato
   * que el controller viejo: solo id y nombre (sin exponer password/email).
   */
  async listarActivos(rol) {
    const { rows } = rol
      ? await this.query(
          'SELECT id, nombre FROM usuarios WHERE activo = true AND rol = $1 ORDER BY nombre',
          [rol]
        )
      : await this.query(
          'SELECT id, nombre FROM usuarios WHERE activo = true ORDER BY nombre'
        );
    return rows;
  }
}

module.exports = UsuarioRepository;
