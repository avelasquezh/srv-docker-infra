const BaseService = require('../../core/BaseService');

class CompraService extends BaseService {
  listarPorProducto(id) { return this.repos.compras.listarPorProducto(id); }
  obtener(id) { return this.repos.compras.obtenerPorId(id); }
  productoExiste(id) { return this.repos.compras.productoExiste(id); }
  crear(productoId, datos) { return this.repos.compras.crear(productoId, datos); }
  actualizar(id, datos) { return this.repos.compras.actualizar(id, datos); }
  eliminar(id) { return this.repos.compras.eliminar(id); }
}

module.exports = CompraService;
