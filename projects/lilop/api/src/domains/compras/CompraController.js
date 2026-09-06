const BaseController = require('../../core/BaseController');

class CompraController extends BaseController {
  constructor(service) {
    super(service);
    ['listar', 'obtener', 'crear', 'actualizar', 'eliminar'].forEach((m) => { this[m] = this.handle(this[m].bind(this)); });
  }

  async listar(req, res) { res.json(await this.service.listarPorProducto(req.params.producto_id)); }

  async obtener(req, res) {
    const compra = await this.service.obtener(req.params.id);
    if (!compra) return this.notFound(res, 'Compra no encontrada');
    res.json(compra);
  }

  async crear(req, res) {
    const { concepto, diseno, proveedor, cantidad, valor_unitario: valorUnitario, fecha_compra: fechaCompra, estado } = req.body;
    if (!cantidad || !valorUnitario) return res.status(400).json({ error: 'Cantidad y valor unitario son requeridos' });
    const existe = await this.service.productoExiste(req.params.producto_id);
    if (!existe) return this.notFound(res, 'Producto no encontrado');
    const creada = await this.service.crear(req.params.producto_id, { concepto, diseno, proveedor, cantidad, valorUnitario, fechaCompra, estado });
    res.status(201).json(creada);
  }

  async actualizar(req, res) {
    const { concepto, diseno, proveedor, cantidad, valor_unitario: valorUnitario, fecha_compra: fechaCompra, estado } = req.body;
    const actualizada = await this.service.actualizar(req.params.id, { concepto, diseno, proveedor, cantidad, valorUnitario, fechaCompra, estado });
    if (!actualizada) return this.notFound(res, 'Compra no encontrada');
    res.json(actualizada);
  }

  async eliminar(req, res) {
    const eliminada = await this.service.eliminar(req.params.id);
    if (!eliminada) return this.notFound(res, 'Compra no encontrada');
    res.json({ mensaje: 'Compra eliminada correctamente' });
  }
}

module.exports = CompraController;
