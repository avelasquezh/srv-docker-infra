const BaseService = require('../../core/BaseService');

/**
 * Error de dominio: ya existe un registro con ese nombre/slug único.
 * El controller lo distingue con `instanceof` — nunca conoce el
 * código de Postgres (23505), eso queda encapsulado aquí.
 */
class RegistroDuplicadoError extends Error {}

/**
 * MaestroService — reglas de negocio de los 4 catálogos maestros
 * (origenes_venta, conceptos_costo, conceptos_compra, categorias).
 * Recibe sus repositorios por constructor (this.repos.origenes,
 * .conceptosCosto, .conceptosCompra, .categorias).
 */
class MaestroService extends BaseService {
  _traducirDuplicado(err, mensaje) {
    if (err.code === '23505') return new RegistroDuplicadoError(mensaje);
    return err;
  }

  /* Orígenes de venta */
  listarOrigenes() { return this.repos.origenes.listar(); }
  async crearOrigen(nombre) {
    try { return await this.repos.origenes.crear(nombre); }
    catch (err) { throw this._traducirDuplicado(err, 'El origen ya existe'); }
  }
  eliminarOrigen(id) { return this.repos.origenes.eliminar(id); }

  /* Conceptos de costo */
  listarConceptos() { return this.repos.conceptosCosto.listar(); }
  async crearConcepto(nombre) {
    try { return await this.repos.conceptosCosto.crear(nombre); }
    catch (err) { throw this._traducirDuplicado(err, 'El concepto ya existe'); }
  }
  eliminarConcepto(id) { return this.repos.conceptosCosto.eliminar(id); }

  /* Conceptos de compra */
  listarConceptosCompra() { return this.repos.conceptosCompra.listar(); }
  async crearConceptoCompra(nombre) {
    try { return await this.repos.conceptosCompra.crear(nombre); }
    catch (err) { throw this._traducirDuplicado(err, 'El concepto ya existe'); }
  }
  eliminarConceptoCompra(id) { return this.repos.conceptosCompra.eliminar(id); }

  /* Categorías */
  listarCategorias() { return this.repos.categorias.listar(); }
  async crearCategoria(nombre, slug, tipo) {
    try { return await this.repos.categorias.crear(nombre, slug, tipo); }
    catch (err) { throw this._traducirDuplicado(err, 'El slug ya existe'); }
  }
  async actualizarCategoria(id, datos) {
    try { return await this.repos.categorias.actualizar(id, datos); }
    catch (err) { throw this._traducirDuplicado(err, 'El slug ya existe'); }
  }
  eliminarCategoria(id) { return this.repos.categorias.eliminar(id); }
}

module.exports = { MaestroService, RegistroDuplicadoError };
