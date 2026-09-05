/**
 * DomicilioRepository — capa de "acceso a datos" del dominio domicilio,
 * salvo que aquí el dato no vive en Postgres sino en un webhook externo
 * de n8n. Deliberadamente NO extiende BaseRepository: ese contrato
 * envuelve `pool.query` (SQL), y forzar la herencia aquí violaría
 * Sustitución de Liskov (un cliente HTTP no es intercambiable por un
 * pool de Postgres). Se aplica el mismo principio de Inversión de
 * Dependencias a mano: la URL y el `fetch` se inyectan por constructor,
 * nunca se importan/hardcodean dentro de la clase.
 */
class DomicilioRepository {
  /**
   * @param {string} webhookUrl - URL del webhook, inyectada (nunca hardcodeada aquí)
   * @param {typeof fetch} fetchImpl - permite inyectar un fetch falso en tests
   */
  constructor(webhookUrl, fetchImpl = fetch) {
    if (!webhookUrl) {
      throw new Error('DomicilioRepository: se requiere webhookUrl inyectada');
    }
    this.webhookUrl = webhookUrl;
    this.fetch = fetchImpl;
  }

  /** Reenvía la solicitud de domicilio de un pedido al webhook de n8n. */
  async enviar(pedidoId, payload) {
    const response = await this.fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoId, ...payload }),
    });
    if (!response.ok) {
      throw new Error(`Webhook error ${response.status}`);
    }
    return true;
  }
}

module.exports = DomicilioRepository;
