const BaseService = require('../../core/BaseService');

/** Error de dominio: email ya registrado (Postgres 23505 en email único). */
class EmailDuplicadoError extends Error {}

const toTitleCase = (str) =>
  str && str.trim().replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * UsuarioService — CRUD administrativo de usuarios/vendedores.
 * `bcrypt` inyectado por constructor (mismo criterio que AuthService)
 * para poder testear hashing sin cómputo real.
 */
class UsuarioService extends BaseService {
  constructor(repositorios, deps) {
    super(repositorios);
    if (!deps || !deps.bcrypt) {
      throw new Error('UsuarioService: se requiere bcrypt inyectado');
    }
    this.bcrypt = deps.bcrypt;
  }

  listar() { return this.repos.usuarios.listar(); }
  obtener(id) { return this.repos.usuarios.obtener(id); }

  async crear({ nombre, celular, email, password, rol, comisionPct }) {
    const passwordHash = password ? await this.bcrypt.hash(password, 10) : null;
    try {
      return await this.repos.usuarios.crear({
        nombre: toTitleCase(nombre),
        celular,
        email,
        passwordHash,
        rol,
        comisionPct,
      });
    } catch (err) {
      if (err.code === '23505') throw new EmailDuplicadoError('El email ya está registrado');
      throw err;
    }
  }

  async actualizar(id, { nombre, celular, email, rol, comisionPct, activo }) {
    try {
      return await this.repos.usuarios.actualizar(id, {
        nombre: toTitleCase(nombre),
        celular,
        email,
        rol,
        comisionPct,
        activo,
      });
    } catch (err) {
      if (err.code === '23505') throw new EmailDuplicadoError('El email ya está registrado');
      throw err;
    }
  }

  async cambiarPassword(id, password) {
    const hash = await this.bcrypt.hash(password, 10);
    return this.repos.usuarios.cambiarPassword(id, hash);
  }

  eliminar(id) { return this.repos.usuarios.eliminar(id); }
}

module.exports = { UsuarioService, EmailDuplicadoError };
