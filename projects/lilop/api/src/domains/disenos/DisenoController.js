const BaseController = require('../../core/BaseController');

class DisenoController extends BaseController {
  constructor(service) {
    super(service);
    this.listar = this.handle(this.listar.bind(this));
    this.crear = this.handle(this.crear.bind(this));
    this.actualizar = this.handle(this.actualizar.bind(this));
    this.eliminar = this.handle(this.eliminar.bind(this));
    this.listarProductos = this.handle(this.listarProductos.bind(this));
    this.actualizarProductos = this.handle(this.actualizarProductos.bind(this));
  }

  async listar(req, res) {
    res.json(await this.service.listar(req.query.catalogo_id));
  }

  async crear(req, res) {
    const { nombre, catalogo, imagen, estado } = req.body;
    res.status(201).json(await this.service.crear({ nombre, catalogo, imagen, estado }));
  }

  async actualizar(req, res) {
    const { nombre, catalogo, imagen, estado } = req.body;
    const actualizado = await this.service.actualizar(req.params.id, { nombre, catalogo, imagen, estado });
    if (!actualizado) return this.notFound(res, 'Diseño no encontrado');
    res.json(actualizado);
  }

  async eliminar(req, res) {
    const eliminado = await this.service.eliminar(req.params.id);
    if (!eliminado) return this.notFound(res, 'Diseño no encontrado');
    res.json({ ok: true });
  }

  async listarProductos(req, res) {
    res.json(await this.service.listarProductos(req.params.id));
  }

  async actualizarProductos(req, res) {
    const { catalogo_ids } = req.body;
    if (!Array.isArray(catalogo_ids)) {
      return res.status(400).json({ error: 'catalogo_ids debe ser un array' });
    }
    await this.service.actualizarProductos(req.params.id, catalogo_ids);
    res.json({ ok: true });
  }
}

module.exports = DisenoController;
