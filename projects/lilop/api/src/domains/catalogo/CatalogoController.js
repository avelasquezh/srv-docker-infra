const BaseController = require('../../core/BaseController');

/**
 * CatalogoController — capa HTTP. Reemplaza a controllers/catalogo.js
 * (versión funcional) — mismo contrato exacto en cada endpoint,
 * incluido `listarPublico` (usado como endpoint público sin auth,
 * montado directo en index.js — mismo patrón que `atributos`).
 */
class CatalogoController extends BaseController {
  constructor(service) {
    super(service);
    ['listar', 'crear', 'actualizar', 'toggleActivo', 'eliminar', 'upsertPrecio', 'listarPublico']
      .forEach((m) => { this[m] = this.handle(this[m].bind(this)); });
  }

  async listar(req, res) {
    res.json(await this.service.listar());
  }

  async crear(req, res) {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    res.status(201).json(await this.service.crear({ nombre }));
  }

  async actualizar(req, res) {
    const producto = await this.service.actualizar(req.params.id, req.body);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  }

  async toggleActivo(req, res) {
    res.json(await this.service.toggleActivo(req.params.id));
  }

  async eliminar(req, res) {
    const eliminado = await this.service.eliminar(req.params.id);
    if (!eliminado) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  }

  async upsertPrecio(req, res) {
    const { tamanio, precio } = req.body;
    if (!tamanio || precio === undefined) {
      return res.status(400).json({ error: 'tamanio y precio son requeridos' });
    }
    res.json(await this.service.upsertPrecio(req.params.catalogo_id, { tamanio, precio }));
  }

  async listarPublico(req, res) {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await this.service.listarPublico());
  }
}

module.exports = CatalogoController;
