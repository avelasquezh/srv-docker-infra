const BaseService = require('../../core/BaseService');

class DisenoService extends BaseService {
  listar(catalogoId) { return this.repos.disenos.listar(catalogoId); }

  crear({ nombre, catalogo, imagen, estado }) {
    const nombreLimpio = nombre?.trim() || this._generarNombre();
    return this.repos.disenos.crear({ nombre: nombreLimpio, catalogo, imagen, estado });
  }

  actualizar(id, { nombre, catalogo, imagen, estado }) {
    return this.repos.disenos.actualizar(id, { nombre: nombre?.trim() || null, catalogo, imagen, estado });
  }

  eliminar(id) { return this.repos.disenos.eliminar(id); }
  listarProductos(disenoId) { return this.repos.disenos.listarProductos(disenoId); }
  actualizarProductos(disenoId, catalogoIds) { return this.repos.disenos.reemplazarProductos(disenoId, catalogoIds); }

  _generarNombre() {
    return `DISEÑO-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
  }
}

module.exports = DisenoService;
