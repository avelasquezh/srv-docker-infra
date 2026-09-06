const BaseService = require('../../core/BaseService');

/**
 * ProductoPedidoService — reglas de negocio de las líneas de producto de un
 * pedido.
 *
 * Nota de fidelidad (preservada tal cual del controller original, no se
 * corrige aquí): el nombre de columna `valor_venta_override` es engañoso —
 * también se usa para guardar el precio *calculado automáticamente* del
 * catálogo legacy cuando el caller no manda un override explícito. Es
 * decisión de diseño preexistente, no un bug introducido en este refactor.
 */
class ProductoPedidoService extends BaseService {
  listarPorPedido(pedidoId) { return this.repos.productos.listarPorPedido(pedidoId); }
  pedidoExiste(pedidoId) { return this.repos.productos.pedidoExiste(pedidoId); }
  eliminar(id) { return this.repos.productos.eliminar(id); }
  catalogoNombres() { return this.repos.productos.catalogoNombres(); }

  async obtener(id) {
    const producto = await this.repos.productos.obtenerPorId(id);
    if (!producto) return null;
    const compras = await this.repos.productos.comprasDe(id);
    return { ...producto, compras };
  }

  async crear(pedidoId, { nombre, tamanio, diseno, estado, cantidad }) {
    const cant = parseInt(cantidad) || 1;
    const precioUnitario = await this.repos.productos.precioCatalogo(nombre, tamanio);
    const precioBase = precioUnitario ? precioUnitario * cant : null;

    return this.repos.productos.crear({
      pedidoId, nombre, tamanio, diseno, estado,
      valorVentaOverride: precioBase, cantidad: cant,
    });
  }

  async actualizar(id, { nombre, tamanio, diseno, estado, valor_venta_override: overrideEnviado, cantidad }) {
    let overrideFinal = overrideEnviado !== undefined ? overrideEnviado : null;

    if (overrideFinal === null) {
      const actuales = await this.repos.productos.camposActuales(id);
      const nombreFinal   = nombre  || actuales?.nombre;
      const tamanioFinal   = tamanio || actuales?.tamanio;
      const cantidadFinal = parseInt(cantidad) || actuales?.cantidad || 1;
      const precioUnitario = await this.repos.productos.precioCatalogo(nombreFinal, tamanioFinal);
      overrideFinal = precioUnitario ? precioUnitario * cantidadFinal : null;
    }

    return this.repos.productos.actualizar(id, {
      nombre, tamanio, diseno, estado,
      valorVentaOverride: overrideFinal, cantidad,
    });
  }
}

module.exports = ProductoPedidoService;
