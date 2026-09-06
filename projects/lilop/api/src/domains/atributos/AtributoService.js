const BaseService = require('../../core/BaseService');

class AtributoService extends BaseService {
  listar() { return this.repos.atributos.listar(); }

  crear({ nombre, tipo, sobreprecio }) {
    return this.repos.atributos.crear({ nombre: nombre.trim(), tipo, sobreprecio: parseFloat(sobreprecio) || 0 });
  }

  actualizar(id, { nombre, sobreprecio, activo }) {
    return this.repos.atributos.actualizar(id, {
      nombre: nombre || null,
      sobreprecio: sobreprecio !== undefined ? parseFloat(sobreprecio) : null,
      activo: activo ?? null,
    });
  }

  eliminar(id) { return this.repos.atributos.eliminar(id); }

  crearOpcion(atributoId, { nombre, valor }) {
    return this.repos.atributos.crearOpcion(atributoId, { nombre: nombre.trim(), valor: valor.trim() });
  }

  eliminarOpcion(opcionId) { return this.repos.atributos.eliminarOpcion(opcionId); }
  listarPorProducto(catalogoId) { return this.repos.atributos.listarPorProducto(catalogoId); }
  actualizarAtributosProducto(catalogoId, atributoIds) { return this.repos.atributos.reemplazarAtributosProducto(catalogoId, atributoIds); }
}

module.exports = AtributoService;
