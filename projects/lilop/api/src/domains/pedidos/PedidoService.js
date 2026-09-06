const BaseService = require('../../core/BaseService');

class MedioPagoInvalidoError extends Error {}

class PedidoService extends BaseService {
  listar(filtros) { return this.repos.pedidos.listar(filtros); }
  cambiarEstado(id, estado) { return this.repos.pedidos.cambiarEstado(id, estado); }
  eliminar(id) { return this.repos.pedidos.eliminar(id); }

  async obtener(id) {
    const pedido = await this.repos.pedidos.obtenerResumen(id);
    if (!pedido) return null;
    const productos = await this.repos.pedidos.productosConCompras(id);
    return { ...pedido, productos };
  }

  /** Traduce el nombre de medio de pago a su id, o lanza
   * MedioPagoInvalidoError si viene un nombre que no existe en
   * `medios_pago`. Si no viene nombre (`undefined`/vacío), devuelve `null`
   * — mismo comportamiento exacto del controller original (medio_pago es
   * opcional en crear/actualizar). */
  async resolverMedioPago(nombre) {
    if (!nombre) return null;
    const id = await this.repos.pedidos.buscarMedioPago(nombre);
    if (id === null) throw new MedioPagoInvalidoError('medio_pago inválido');
    return id;
  }

  async crear({ cliente_id: clienteId, vendedor_id: vendedorId, fecha_entrega: fechaEntrega, valor_venta: valorVenta, valor_domicilio: valorDomicilio, domiciliario, medio_pago: medioPago, estado, notas }) {
    const medioPagoId = await this.resolverMedioPago(medioPago);
    return this.repos.pedidos.crear({
      clienteId, vendedorId, fechaEntrega, valorVenta, valorDomicilio,
      domiciliario, medioPagoId, estado, notas,
    });
  }

  async actualizar(id, { fecha_entrega: fechaEntrega, valor_venta: valorVenta, valor_domicilio: valorDomicilio, domiciliario, medio_pago: medioPago, estado, notas, vendedor_id: vendedorId }) {
    const medioPagoId = await this.resolverMedioPago(medioPago);
    return this.repos.pedidos.actualizar(id, {
      fechaEntrega, valorVenta, valorDomicilio, domiciliario, medioPagoId,
      estado, notas, vendedorId,
    });
  }
}

module.exports = { PedidoService, MedioPagoInvalidoError };
