const BaseService = require('../../core/BaseService');

class EntregaService extends BaseService {
  listarPorPedido(pedidoId) { return this.repos.entregas.listarPorPedido(pedidoId); }
  obtener(id) { return this.repos.entregas.obtenerPorId(id); }
  pedidoExiste(pedidoId) { return this.repos.entregas.pedidoExiste(pedidoId); }
  crear(pedidoId, datos) { return this.repos.entregas.crear(pedidoId, datos); }
  actualizar(id, datos) { return this.repos.entregas.actualizar(id, datos); }
  eliminar(id) { return this.repos.entregas.eliminar(id); }
}

module.exports = EntregaService;
