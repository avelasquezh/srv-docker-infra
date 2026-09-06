const BaseController = require('../../core/BaseController');

class AtributoController extends BaseController {
  constructor(service) {
    super(service);
    ['listar', 'crear', 'actualizar', 'eliminar', 'crearOpcion', 'eliminarOpcion', 'listarPorProducto', 'actualizarAtributosProducto']
      .forEach((m) => { this[m] = this.handle(this[m].bind(this)); });
  }

  async listar(req, res) { res.json(await this.service.listar()); }

  async crear(req, res) {
    const { nombre, tipo, sobreprecio } = req.body;
    if (!nombre || !tipo) return res.status(400).json({ error: 'nombre y tipo son requeridos' });
    try {
      res.status(201).json(await this.service.crear({ nombre, tipo, sobreprecio }));
    } catch (err) {
      if (err.code === '23505') return res.status(400).json({ error: 'El atributo ya existe' });
      throw err;
    }
  }

  async actualizar(req, res) {
    const { nombre, sobreprecio, activo } = req.body;
    const actualizado = await this.service.actualizar(req.params.id, { nombre, sobreprecio, activo });
    if (!actualizado) return this.notFound(res, 'Atributo no encontrado');
    res.json(actualizado);
  }

  async eliminar(req, res) {
    await this.service.eliminar(req.params.id);
    res.json({ ok: true });
  }

  async crearOpcion(req, res) {
    const { nombre, valor } = req.body;
    if (!nombre || !valor) return res.status(400).json({ error: 'nombre y valor son requeridos' });
    try {
      res.status(201).json(await this.service.crearOpcion(req.params.id, { nombre, valor }));
    } catch (err) {
      if (err.code === '23505') return res.status(400).json({ error: 'La opción ya existe' });
      throw err;
    }
  }

  async eliminarOpcion(req, res) {
    await this.service.eliminarOpcion(req.params.opcionId);
    res.json({ ok: true });
  }

  async listarPorProducto(req, res) {
    res.json(await this.service.listarPorProducto(req.params.catalogo_id));
  }

  async actualizarAtributosProducto(req, res) {
    const { atributo_ids: atributoIds } = req.body;
    if (!Array.isArray(atributoIds)) return res.status(400).json({ error: 'atributo_ids debe ser array' });
    await this.service.actualizarAtributosProducto(req.params.catalogo_id, atributoIds);
    res.json({ ok: true });
  }
}

module.exports = AtributoController;
