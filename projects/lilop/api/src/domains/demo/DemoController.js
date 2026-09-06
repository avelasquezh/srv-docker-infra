const BaseController = require('../../core/BaseController');

class DemoController extends BaseController {
  constructor(service) {
    super(service);
    ['run', 'status', 'updateStep'].forEach((m) => { this[m] = this.handle(this[m].bind(this)); });
  }

  async run(req, res) {
    const { test_case_id, correo } = req.body;
    if (!test_case_id || !correo) {
      return res.status(400).json({ error: 'test_case_id y correo son requeridos' });
    }
    res.json(await this.service.run(req.body));
  }

  async status(req, res) {
    const ejecucion = await this.service.obtenerEstado(req.params.id);
    if (!ejecucion) return this.notFound(res, 'Ejecución no encontrada');
    res.json(ejecucion);
  }

  async updateStep(req, res) {
    const { step_key, status, result } = req.body;
    const actualizado = await this.service.actualizarPaso(req.params.id, step_key, status, result);
    if (!actualizado) return this.notFound(res, 'No encontrado');
    res.json({ ok: true });
  }
}

module.exports = DemoController;
