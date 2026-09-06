const BaseController = require('../../core/BaseController');
const { EmailDuplicadoError } = require('./UsuarioService');

/** nombre no vacío tras trim (mismo criterio de validación que el controller viejo). */
function nombreValido(nombre) {
  return Boolean(nombre && nombre.trim());
}

class UsuarioController extends BaseController {
  constructor(service) {
    super(service);
    ['listar', 'obtener', 'crear', 'actualizar', 'cambiarPassword', 'eliminar']
      .forEach((m) => { this[m] = this.handle(this[m].bind(this)); });
  }

  _duplicadoOThrow(res, err) {
    if (err instanceof EmailDuplicadoError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  async listar(req, res) { res.json(await this.service.listar()); }

  async obtener(req, res) {
    const usuario = await this.service.obtener(req.params.id);
    if (!usuario) return this.notFound(res, 'Usuario no encontrado');
    res.json(usuario);
  }

  async crear(req, res) {
    const { nombre, celular, email, password, rol, comision_pct } = req.body;
    if (!nombreValido(nombre)) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    try {
      const usuario = await this.service.crear({ nombre, celular, email, password, rol, comisionPct: comision_pct });
      res.status(201).json(usuario);
    } catch (err) { this._duplicadoOThrow(res, err); }
  }

  async actualizar(req, res) {
    const { nombre, celular, email, rol, comision_pct, activo } = req.body;
    try {
      const usuario = await this.service.actualizar(req.params.id, {
        nombre, celular, email, rol, comisionPct: comision_pct, activo,
      });
      if (!usuario) return this.notFound(res, 'Usuario no encontrado');
      res.json(usuario);
    } catch (err) { this._duplicadoOThrow(res, err); }
  }

  async cambiarPassword(req, res) {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'La contraseña es requerida' });
    const usuario = await this.service.cambiarPassword(req.params.id, password);
    if (!usuario) return this.notFound(res, 'Usuario no encontrado');
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  }

  async eliminar(req, res) {
    const usuario = await this.service.eliminar(req.params.id);
    if (!usuario) return this.notFound(res, 'Usuario no encontrado');
    res.json({ ok: true });
  }
}

module.exports = UsuarioController;
