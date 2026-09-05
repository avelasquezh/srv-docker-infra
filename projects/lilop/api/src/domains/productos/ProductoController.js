const BaseController = require('../../core/BaseController');

/**
 * ProductoController — capa HTTP del dominio productos. Sin SQL, sin
 * lógica de negocio, sin try/catch propio (lo resuelve BaseController).
 */
class ProductoController extends BaseController {
  constructor(service) {
    super(service);
    // bind explícito: los métodos se pasan como referencia a router.get(...),
    // así que necesitan su propio `this` fijo en vez del que les dé Express.
    this.listar = this.handle(this.listar.bind(this));
    this.obtener = this.handle(this.obtener.bind(this));
  }

  async listar(req, res) {
    const productos = await this.service.listarParaBot();
    res.set('Cache-Control', 'public, max-age=60');
    res.json(productos);
  }

  async obtener(req, res) {
    const producto = await this.service.obtenerParaBot(req.params.id);
    if (!producto) return this.notFound(res, 'Producto no encontrado');
    res.set('Cache-Control', 'public, max-age=60');
    res.json(producto);
  }
}

module.exports = ProductoController;
