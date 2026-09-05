const BaseController = require('../../core/BaseController');

/**
 * DomicilioController — capa HTTP del dominio domicilio. Sin fetch,
 * sin lógica de negocio, sin try/catch propio (lo resuelve
 * BaseController.handle).
 */
class DomicilioController extends BaseController {
  constructor(service) {
    super(service);
    this.enviar = this.handle(this.enviar.bind(this));
  }

  async enviar(req, res) {
    await this.service.enviarNotificacion(req.params.id, req.body);
    res.json({ ok: true });
  }
}

module.exports = DomicilioController;
