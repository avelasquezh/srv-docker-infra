const BaseService = require('../../core/BaseService');

const STEPS = [
  { key: 'received',    label: 'Test Case recibido',         detail: 'ID validado y registrado' },
  { key: 'auth',        label: 'Usuario autenticado',        detail: 'Token de servicio inyectado' },
  { key: 'run_created', label: 'Test Run creado',            detail: 'Azure DevOps — Run abierto' },
  { key: 'point',       label: 'Test Point asignado',        detail: 'Vinculado al run activo' },
  { key: 'evidence',    label: 'Evidencia cargada',          detail: 'Archivo adjunto al run' },
  { key: 'execution',   label: 'Ejecución disparada',        detail: 'Pipeline de pruebas iniciado' },
  { key: 'result',      label: 'Resultado capturado',        detail: 'PASSED — sin errores' },
  { key: 'comment',     label: 'Comentario adjuntado',       detail: 'Evidencia y logs incluidos' },
  { key: 'closed',      label: 'Run cerrado en Azure',       detail: 'Estado final registrado' },
  { key: 'dashboard',   label: 'Tablero actualizado',        detail: 'Métricas sincronizadas' },
  { key: 'email',       label: 'Reporte enviado por correo', detail: 'Notificación al responsable' },
];

/**
 * DemoService — orquesta la demo guiada (Azure DevOps + n8n). `fetch`
 * y la URL del webhook se inyectan por constructor (mismo criterio de
 * DomicilioRepository): permite testear sin disparar el webhook real.
 * El disparo al webhook es fire-and-forget a propósito (igual que el
 * controller viejo): no se espera su respuesta ni bloquea el `res.json`.
 */
class DemoService extends BaseService {
  constructor(repositorios, deps) {
    super(repositorios);
    if (!deps || !deps.webhookUrl) {
      throw new Error('DemoService: se requiere webhookUrl inyectada');
    }
    this.fetch = deps.fetchImpl || fetch;
    this.webhookUrl = deps.webhookUrl;
  }

  async run({ test_case_id, nombre, empresa, correo }) {
    const initialSteps = STEPS.map((s) => ({ ...s, status: 'pending', timestamp: null }));
    const executionId = await this.repos.demo.crearEjecucion(test_case_id, initialSteps);

    const payload = {
      execution_id: executionId,
      test_case_id,
      nombre: nombre || 'Prospecto',
      empresa: empresa || '',
      correo,
    };
    this.fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => console.error('n8n webhook error:', err.message));

    return { ok: true, execution_id: executionId };
  }

  obtenerEstado(id) { return this.repos.demo.obtenerEstado(id); }

  async actualizarPaso(id, stepKey, stepStatus, result) {
    const steps = await this.repos.demo.obtenerSteps(id);
    if (!steps) return null;

    const stepsActualizados = steps.map((s) =>
      s.key === stepKey ? { ...s, status: stepStatus, timestamp: new Date().toISOString() } : s
    );
    const allDone = stepsActualizados.every((s) => s.status === 'done');
    const finalStatus = allDone ? 'completed' : 'running';

    await this.repos.demo.actualizarSteps(
      id, stepsActualizados, finalStatus, result, allDone ? new Date() : null
    );
    return true;
  }
}

module.exports = DemoService;
