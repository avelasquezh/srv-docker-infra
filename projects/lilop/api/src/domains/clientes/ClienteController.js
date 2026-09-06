const BaseController = require('../../core/BaseController');

class ClienteController extends BaseController {
  constructor(service) {
    super(service);
    ['listar', 'obtener', 'crear', 'actualizar', 'eliminar', 'pedidos', 'listaOrigenes']
      .forEach((m) => { this[m] = this.handle(this[m].bind(this)); });
  }

  async listar(req, res) { res.json(await this.service.listar()); }

  async obtener(req, res) {
    const cliente = await this.service.obtener(req.params.id);
    if (!cliente) return this.notFound(res, 'Cliente no encontrado');
    res.json(cliente);
  }

  async crear(req, res) {
    const { nombre, celular, departamento, ciudad, localidad, barrio, direccion, origen_venta: origenVenta } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    res.status(201).json(await this.service.crear({ nombre, celular, departamento, ciudad, localidad, barrio, direccion, origenVenta }));
  }

  async actualizar(req, res) {
    const { id } = req.params;
    const { nombre, celular, departamento, ciudad, localidad, barrio, direccion, origen_venta: origenVenta } = req.body;
    if (celular && await this.service.celularEnUso(celular, id)) {
      return res.status(409).json({ error: `El celular ${celular} ya está registrado` });
    }
    const actualizado = await this.service.actualizar(id, { nombre, celular, departamento, ciudad, localidad, barrio, direccion, origenVenta });
    if (!actualizado) return this.notFound(res, 'Cliente no encontrado');
    res.json(actualizado);
  }

  async eliminar(req, res) {
    const { id } = req.params;
    if (await this.service.tienePedidos(id)) {
      return res.status(400).json({ error: 'No se puede eliminar un cliente con pedidos registrados' });
    }
    const eliminado = await this.service.eliminar(id);
    if (!eliminado) return this.notFound(res, 'Cliente no encontrado');
    res.json({ mensaje: 'Cliente eliminado correctamente' });
  }

  async pedidos(req, res) { res.json(await this.service.pedidosDe(req.params.id)); }
  async listaOrigenes(req, res) { res.json(await this.service.listaOrigenes()); }
}

module.exports = ClienteController;
