const BaseController = require('../../core/BaseController');

class EntregaController extends BaseController {
  constructor(service) {
    super(service);
    this.listar = this.handle(this.listar.bind(this));
    this.obtener = this.handle(this.obtener.bind(this));
    this.crear = this.handle(this.crear.bind(this));
    this.actualizar = this.handle(this.actualizar.bind(this));
    this.eliminar = this.handle(this.eliminar.bind(this));
  }

  async listar(req, res) {
    res.json(await this.service.listarPorPedido(req.params.pedido_id));
  }

  async obtener(req, res) {
    const entrega = await this.service.obtener(req.params.id);
    if (!entrega) return this.notFound(res, 'Entrega no encontrada');
    res.json(entrega);
  }

  async crear(req, res) {
    const existe = await this.service.pedidoExiste(req.params.pedido_id);
    if (!existe) return this.notFound(res, 'Pedido no encontrado');
    const { fecha_entrega, valor_domicilio, domiciliario, estado, notas } = req.body;
    const creada = await this.service.crear(req.params.pedido_id, {
      fechaEntrega: fecha_entrega, valorDomicilio: valor_domicilio, domiciliario, estado, notas,
    });
    res.status(201).json(creada);
  }

  async actualizar(req, res) {
    const { fecha_entrega, valor_domicilio, domiciliario, estado, notas } = req.body;
    const actualizada = await this.service.actualizar(req.params.id, {
      fechaEntrega: fecha_entrega, valorDomicilio: valor_domicilio, domiciliario, estado, notas,
    });
    if (!actualizada) return this.notFound(res, 'Entrega no encontrada');
    res.json(actualizada);
  }

  async eliminar(req, res) {
    const eliminada = await this.service.eliminar(req.params.id);
    if (!eliminada) return this.notFound(res, 'Entrega no encontrada');
    res.json({ mensaje: 'Entrega eliminada correctamente' });
  }
}

module.exports = EntregaController;
