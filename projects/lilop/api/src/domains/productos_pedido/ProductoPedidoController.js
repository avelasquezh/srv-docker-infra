const BaseController = require('../../core/BaseController');

class ProductoPedidoController extends BaseController {
  constructor(service) {
    super(service);
    ['listar', 'obtener', 'crear', 'actualizar', 'eliminar', 'catalogo']
      .forEach((m) => { this[m] = this.handle(this[m].bind(this)); });
  }

  async listar(req, res) {
    res.json(await this.service.listarPorPedido(req.params.pedido_id));
  }

  async obtener(req, res) {
    const producto = await this.service.obtener(req.params.id);
    if (!producto) return this.notFound(res, 'Producto no encontrado');
    res.json(producto);
  }

  async crear(req, res) {
    const { nombre, tamanio, diseno, estado, cantidad } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del producto es requerido' });

    const existe = await this.service.pedidoExiste(req.params.pedido_id);
    if (!existe) return this.notFound(res, 'Pedido no encontrado');

    const creado = await this.service.crear(req.params.pedido_id, { nombre, tamanio, diseno, estado, cantidad });
    res.status(201).json(creado);
  }

  async actualizar(req, res) {
    const { nombre, tamanio, diseno, estado, valor_venta_override, cantidad } = req.body;
    const actualizado = await this.service.actualizar(req.params.id, {
      nombre, tamanio, diseno, estado, valor_venta_override, cantidad,
    });
    if (!actualizado) return this.notFound(res, 'Producto no encontrado');
    res.json(actualizado);
  }

  async eliminar(req, res) {
    const eliminado = await this.service.eliminar(req.params.id);
    if (!eliminado) return this.notFound(res, 'Producto no encontrado');
    res.json({ mensaje: 'Producto eliminado correctamente' });
  }

  async catalogo(req, res) {
    res.json(await this.service.catalogoNombres());
  }
}

module.exports = ProductoPedidoController;
