/**
 * BaseController — clase base para la capa HTTP.
 *
 * Responsabilidad única: traducir HTTP (req/res) a llamadas al service,
 * y errores de service a códigos de estado. Ningún controller hijo
 * debe tener try/catch repetido (elimina la duplicación que existía en
 * todos los controllers viejos, uno por uno) — se resuelve una sola vez
 * aquí con `this.handle(...)`.
 */
class BaseController {
  /**
   * @param {import('./BaseService')} service - service inyectado por constructor
   */
  constructor(service) {
    this.service = service;
  }

  /**
   * Envuelve un handler async: captura errores, loguea, y responde 500
   * genérico. Los controllers hijos solo escriben la lógica feliz.
   *
   * Uso: router.get('/x', controller.handle(async (req, res) => {...}))
   */
  handle(fn) {
    return async (req, res) => {
      try {
        await fn(req, res);
      } catch (err) {
        console.error(`${this.constructor.name} error:`, err.message);
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    };
  }

  notFound(res, mensaje = 'Recurso no encontrado') {
    return res.status(404).json({ error: mensaje });
  }
}

module.exports = BaseController;
