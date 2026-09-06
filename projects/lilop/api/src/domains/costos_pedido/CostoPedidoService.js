const BaseService = require('../../core/BaseService');

/**
 * CostoPedidoService — reglas de negocio de los 3 sub-recursos de
 * costos de un pedido. Deliberadamente delgado: la validación de
 * campos requeridos vive en el controller (mismo criterio que el
 * resto de dominios ya migrados), y el recálculo de los totales en
 * `pedidos` vive enteramente en los triggers de BD (004/007) — este
 * service nunca debe reintroducir ese cálculo a mano.
 */
class CostoPedidoService extends BaseService {
  async listarCostos(pedidoId) {
    const [otros, entregas, comisiones] = await Promise.all([
      this.repos.costos.listarOtros(pedidoId),
      this.repos.costos.listarEntregas(pedidoId),
      this.repos.costos.listarComisiones(pedidoId),
    ]);
    return { otros, domicilio: entregas, comision: comisiones };
  }

  crearOtro(pedidoId, datos) { return this.repos.costos.crearOtro(pedidoId, datos); }
  eliminarOtro(id) { return this.repos.costos.eliminarOtro(id); }
  listaConceptosOtros() { return this.repos.costos.listaConceptosOtros(); }

  crearEntrega(pedidoId, datos) { return this.repos.costos.crearEntrega(pedidoId, datos); }
  eliminarEntrega(id) { return this.repos.costos.eliminarEntrega(id); }
  cambiarEstadoPagoEntrega(id, estadoPago) { return this.repos.costos.cambiarEstadoPagoEntrega(id, estadoPago); }
  listaDomiciliarios() { return this.repos.costos.listaDomiciliarios(); }

  crearComision(pedidoId, datos) { return this.repos.costos.crearComision(pedidoId, datos); }
  eliminarComision(id) { return this.repos.costos.eliminarComision(id); }
  cambiarEstadoComision(id, estado) { return this.repos.costos.cambiarEstadoComision(id, estado); }
  listaVendedoresComision() { return this.repos.costos.listaVendedoresComision(); }
}

module.exports = CostoPedidoService;
