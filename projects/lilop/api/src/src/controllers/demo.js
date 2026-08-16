const pool = require('../config/db');

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

async function run(req, res) {
  const { test_case_id, nombre, empresa, correo } = req.body;

  if (!test_case_id || !correo) {
    return res.status(400).json({ error: 'test_case_id y correo son requeridos' });
  }

  try {
    const initialSteps = STEPS.map(s => ({
      ...s, status: 'pending', timestamp: null
    }));

    const { rows } = await pool.query(
      `INSERT INTO demo_executions (test_case_id, steps)
       VALUES ($1, $2) RETURNING id`,
      [test_case_id, JSON.stringify(initialSteps)]
    );

    const executionId = rows[0].id;

    const n8nPayload = {
      execution_id: executionId,
      test_case_id,
      nombre: nombre || 'Prospecto',
      empresa: empresa || '',
      correo,
    };

    fetch(process.env.N8N_DEMO_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
    }).catch(err => console.error('n8n webhook error:', err.message));

    res.json({ ok: true, execution_id: executionId });
  } catch (err) {
    console.error('demo run error:', err.message);
    res.status(500).json({ error: 'Error al iniciar la ejecución' });
  }
}

async function status(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, test_case_id, status, result, steps, created_at, completed_at
       FROM demo_executions WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ejecución no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('demo status error:', err.message);
    res.status(500).json({ error: 'Error al consultar estado' });
  }
}

async function updateStep(req, res) {
  const { id } = req.params;
  const { step_key, status: stepStatus, result } = req.body;

  try {
    const { rows } = await pool.query(
      'SELECT steps FROM demo_executions WHERE id = $1',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

    const steps = rows[0].steps.map(s =>
      s.key === step_key
        ? { ...s, status: stepStatus, timestamp: new Date().toISOString() }
        : s
    );

    const allDone = steps.every(s => s.status === 'done');
    const finalStatus = allDone ? 'completed' : 'running';

    await pool.query(
      `UPDATE demo_executions
       SET steps = $1, status = $2, result = $3,
           completed_at = $4
       WHERE id = $5`,
      [
        JSON.stringify(steps),
        finalStatus,
        result || null,
        allDone ? new Date() : null,
        id,
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('demo updateStep error:', err.message);
    res.status(500).json({ error: 'Error al actualizar paso' });
  }
}

module.exports = { run, status, updateStep };
