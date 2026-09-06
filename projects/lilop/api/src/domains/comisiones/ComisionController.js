const BaseController = require('../../core/BaseController');

class ComisionController extends BaseController {
  constructor(service) {
    super(service);
    this.listar = this.handle(this.listar.bind(this));
    this.obtener = this.handle(this.obtener.bind(this));
    this.cambiarEstado = this.handle(this.cambiarEstado.bind(this));
    this.resumenVendedor = this.handle(this.resumenVendedor.bind(this));
  }

  async listar(req, res) {
    const { vendedor_id: vendedorId, estado } = req.query;
    res.json(await this.service.listar({ vendedorId, estado }));
  }

  async obtener(req, res) {
    const comision = await this.service.obtener(req.params.id);
    if (!comision) return this.notFound(res, 'Comisión no encontrada');
    res.json(comision);
  }

  async cambiarEstado(req, res) {
    const { estado } = req.body;
    if (!estado) return res.status(400).json({ error: 'El estado es requerido' });
    const actualizada = await this.service.cambiarEstado(req.params.id, estado);
    if (!actualizada) return this.notFound(res, 'Comisión no encontrada');
    res.json(actualizada);
  }

  async resumenVendedor(req, res) {
    res.json(await this.service.resumenVendedor(req.params.vendedor_id));
  }
}

module.exports = ComisionController;
