const BaseService = require('../../core/BaseService');

/**
 * DomicilioService — capa de lógica de negocio del dominio domicilio.
 * Hoy es un passthrough (no hay reglas de negocio propias más allá de
 * reenviar), pero vive aquí y no en el controller para que, si algún
 * día se necesita validar el payload o enriquecerlo antes de enviarlo,
 * el controller (capa HTTP) no tenga que cambiar.
 */
class DomicilioService extends BaseService {
  async enviarNotificacion(pedidoId, payload) {
    return this.repos.domicilio.enviar(pedidoId, payload);
  }
}

module.exports = DomicilioService;
