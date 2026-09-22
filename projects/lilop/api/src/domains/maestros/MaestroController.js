const BaseController = require('../../core/BaseController');
const { RegistroDuplicadoError } = require('./MaestroService');

/**
 * MaestroController — capa HTTP de los 4 catálogos maestros.
 *
 * Nota de fidelidad: el código viejo validaba "nombre requerido" con
 * `nombre?.trim()` en orígenes/conceptos, pero solo `!nombre` (sin
 * trim) en conceptos-compra — una inconsistencia preexistente, no
 * introducida aquí. Se preserva tal cual (sin cambios de
 * comportamiento); no se corrige en este commit para no mezclar un
 * fix de negocio con el refactor de arquitectura.
 */
class MaestroController extends BaseController {
  constructor(service) {
    super(service);
    [
      'listarOrigenes', 'crearOrigen', 'eliminarOrigen',
      'listarConceptos', 'crearConcepto', 'eliminarConcepto',
      'listarConceptosCompra', 'crearConceptoCompra', 'eliminarConceptoCompra',
      'listarCategorias', 'crearCategoria', 'actualizarCategoria', 'eliminarCategoria',
    ].forEach((m) => { this[m] = this.handle(this[m].bind(this)); });
  }

  _duplicadoOThrow(res, err) {
    if (err instanceof RegistroDuplicadoError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  /* Orígenes de venta */
  async listarOrigenes(req, res) { res.json(await this.service.listarOrigenes()); }
  async crearOrigen(req, res) {
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    try {
      res.status(201).json(await this.service.crearOrigen(nombre.trim()));
    } catch (err) { this._duplicadoOThrow(res, err); }
  }
  async eliminarOrigen(req, res) {
    await this.service.eliminarOrigen(req.params.id);
    res.json({ ok: true });
  }

  /* Conceptos de costo */
  async listarConceptos(req, res) { res.json(await this.service.listarConceptos()); }
  async crearConcepto(req, res) {
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    try {
      res.status(201).json(await this.service.crearConcepto(nombre.trim()));
    } catch (err) { this._duplicadoOThrow(res, err); }
  }
  async eliminarConcepto(req, res) {
    await this.service.eliminarConcepto(req.params.id);
    res.json({ ok: true });
  }

  /* Conceptos de compra (validación sin trim: fidelidad al original) */
  async listarConceptosCompra(req, res) { res.json(await this.service.listarConceptosCompra()); }
  async crearConceptoCompra(req, res) {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    try {
      res.status(201).json(await this.service.crearConceptoCompra(nombre.trim()));
    } catch (err) { this._duplicadoOThrow(res, err); }
  }
  async eliminarConceptoCompra(req, res) {
    await this.service.eliminarConceptoCompra(req.params.id);
    res.json({ ok: true });
  }

  /* Categorías */
  async listarCategorias(req, res) { res.json(await this.service.listarCategorias()); }
  async crearCategoria(req, res) {
    const { nombre, slug, tipo } = req.body;
    if (!nombre || !slug) return res.status(400).json({ error: 'nombre y slug son requeridos' });
    const slugNormalizado = slug.trim().toLowerCase().replace(/\s+/g, '-');
    const TIPOS_VALIDOS = ['linea_producto', 'material', 'target', 'diseno'];
    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: `tipo inválido, debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` });
    }
    try {
      res.status(201).json(await this.service.crearCategoria(nombre.trim(), slugNormalizado, tipo || null));
    } catch (err) { this._duplicadoOThrow(res, err); }
  }
  async actualizarCategoria(req, res) {
    const { nombre, slug, activo, tipo } = req.body;
    const TIPOS_VALIDOS = ['linea_producto', 'material', 'target', 'diseno'];
    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: `tipo inválido, debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` });
    }
    try {
      const categoria = await this.service.actualizarCategoria(req.params.id, {
        nombre: nombre || null,
        slug: slug || null,
        activo: activo ?? null,
        tipo: tipo || null,
      });
      if (!categoria) return this.notFound(res, 'Categoría no encontrada');
      res.json(categoria);
    } catch (err) { this._duplicadoOThrow(res, err); }
  }
  async eliminarCategoria(req, res) {
    await this.service.eliminarCategoria(req.params.id);
    res.json({ ok: true });
  }
}

module.exports = MaestroController;
