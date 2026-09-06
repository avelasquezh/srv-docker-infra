const BaseService = require('../../core/BaseService');

class ComisionService extends BaseService {
  listar(filtros) { return this.repos.comisiones.listar(filtros); }
  obtener(id) { return this.repos.comisiones.obtenerPorId(id); }
  cambiarEstado(id, estado) { return this.repos.comisiones.cambiarEstado(id, estado); }
  resumenVendedor(vendedorId) { return this.repos.comisiones.resumenPorVendedor(vendedorId); }
}

module.exports = ComisionService;
