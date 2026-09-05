const BaseService = require('../../core/BaseService');

/**
 * ProductoService — aplica el "contrato de respuesta del bot" (ver
 * projects/lilop/docs/migracion-productos-variantes.md sección 7bis).
 * Recibe su repositorio por constructor (this.repos.productos), nunca
 * lo importa directamente — así se puede sustituir por un repositorio
 * de otra fuente sin tocar esta clase (Abierto/Cerrado + Inversión de
 * dependencias).
 */
class ProductoService extends BaseService {
  _formatear(row) {
    return {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion_corta || null,
      variables: (row.variables || []).map((v) => ({
        nombre: v.nombre,
        tipo: v.tipo, // 'lista' | 'booleano'
        valores: v.valores || null, // null cuando es booleano
      })),
      variantes: (row.variantes || []).map((vt) => ({
        id: vt.id,
        atributos: vt.atributos || {},
        precio: Number(vt.precio),
      })),
    };
  }

  async listarParaBot() {
    const rows = await this.repos.productos.listarConVariantes();
    return rows.map((r) => this._formatear(r));
  }

  async obtenerParaBot(catalogoId) {
    const row = await this.repos.productos.obtenerConVariantes(catalogoId);
    return row ? this._formatear(row) : null;
  }
}

module.exports = ProductoService;
