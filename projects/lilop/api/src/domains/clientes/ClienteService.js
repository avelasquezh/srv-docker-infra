const BaseService = require('../../core/BaseService');

class ClienteService extends BaseService {
  listar() { return this.repos.clientes.listar(); }
  obtener(id) { return this.repos.clientes.obtenerPorId(id); }
  pedidosDe(id) { return this.repos.clientes.pedidosDe(id); }
  listaOrigenes() { return this.repos.clientes.listaOrigenes(); }
  celularEnUso(celular, excluirId) { return this.repos.clientes.celularEnUso(celular, excluirId); }
  tienePedidos(id) { return this.repos.clientes.tienePedidos(id); }
  eliminar(id) { return this.repos.clientes.eliminar(id); }

  crear({ nombre, celular, departamento, ciudad, localidad, barrio, direccion, origenVenta }) {
    return this.repos.clientes.crear({
      nombre: this._toTitleCase(nombre), celular, departamento, ciudad, localidad, barrio, direccion, origenVenta,
    });
  }

  actualizar(id, { nombre, celular, departamento, ciudad, localidad, barrio, direccion, origenVenta }) {
    return this.repos.clientes.actualizar(id, {
      nombre: this._toTitleCase(nombre), celular, departamento, ciudad, localidad, barrio, direccion, origenVenta,
    });
  }

  _toTitleCase(str) {
    return str && str.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

module.exports = ClienteService;
