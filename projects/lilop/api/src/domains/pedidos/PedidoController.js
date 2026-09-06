const BaseController = require('../../core/BaseController');
const { MedioPagoInvalidoError } = require('./PedidoService');

class PedidoController extends BaseController {
  constructor(service) {
    super(service);
    ['listar', 'obtener', 'crear', 'actualizar', 'cambiarEstado', 'eliminar']
      .forEach((m) => { this[m] = this.handle(this[m].bind(this)); });
  }

  _medioInvalidoOThrow(res, err) {
    if (err instanceof MedioPagoInvalidoError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  async listar(req, res) {
    const { estado, vendedor_id, cliente_id, desde, hasta } = req.query;
    res.json(await this.service.listar({ estado, vendedor_id, cliente_id, desde, hasta }));
  }

  async obtener(req, res) {
    const pedido = await this.service.obtener(req.params.id);
    if (!pedido) return this.notFound(res, 'Pedido no encontrado');
    res.json(pedido);
  }

  async crear(req, res) {
    const { cliente_id, vendedor_id, valor_venta } = req.body;
    if (!cliente_id || !vendedor_id || valor_venta === undefined || valor_venta === null) {
      return res.status(400).json({ error: 'cliente_id, vendedor_id y valor_venta son requeridos' });
    }
    try {
      res.status(201).json(await this.service.crear(req.body));
    } catch (err) { this._medioInvalidoOThrow(res, err); }
  }

  async actualizar(req, res) {
    try {
      const actualizado = await this.service.actualizar(req.params.id, req.body);
      if (!actualizado) return this.notFound(res, 'Pedido no encontrado');
      res.json(actualizado);
    } catch (err) { this._medioInvalidoOThrow(res, err); }
  }

  async cambiarEstado(req, res) {
    const { estado } = req.body;
    if (!estado) return res.status(400).json({ error: 'El estado es requerido' });
    const actualizado = await this.service.cambiarEstado(req.params.id, estado);
    if (!actualizado) return this.notFound(res, 'Pedido no encontrado');
    res.json(actualizado);
  }

  async eliminar(req, res) {
    const eliminado = await this.service.eliminar(req.params.id);
    if (!eliminado) return this.notFound(res, 'Pedido no encontrado');
    res.json({ mensaje: 'Pedido eliminado correctamente' });
  }
}

module.exports = PedidoController;
