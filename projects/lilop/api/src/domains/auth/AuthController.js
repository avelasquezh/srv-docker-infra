const BaseController = require('../../core/BaseController');
const { CredencialesInvalidasError } = require('./AuthService');

/**
 * AuthController — capa HTTP de login y listado de vendedores.
 * Reemplaza a controllers/auth.js (versión funcional) — mismo
 * contrato exacto (mismos status codes, mismo shape de respuesta).
 */
class AuthController extends BaseController {
  constructor(service) {
    super(service);
    ['login', 'vendedores'].forEach((m) => { this[m] = this.handle(this[m].bind(this)); });
  }

  async login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    try {
      const resultado = await this.service.login(email, password);
      res.json(resultado);
    } catch (err) {
      if (err instanceof CredencialesInvalidasError) {
        return res.status(401).json({ error: err.message });
      }
      throw err;
    }
  }

  async vendedores(req, res) {
    const { rol } = req.query;
    res.json(await this.service.vendedores(rol));
  }
}

module.exports = AuthController;
