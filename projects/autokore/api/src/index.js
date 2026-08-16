const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://autokore.space',
    'https://www.autokore.space',
    'https://demo.autokore.space'
  ]
}));
app.use(express.json());

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', service: 'autokore-api' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// Leads
app.post('/api/leads', async (req, res) => {
  const { nombre, correo, empresa } = req.body;
  if (!nombre || !correo) {
    return res.status(400).json({ error: 'nombre y correo son requeridos' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO leads (nombre, correo, empresa)
       VALUES ($1, $2, $3) RETURNING id`,
      [nombre, correo, empresa || null]
    );
    res.status(201).json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Demo executions — crear ejecución
app.post('/api/demo/execution', async (req, res) => {
  const { test_case_id } = req.body;
  if (!test_case_id) {
    return res.status(400).json({ error: 'test_case_id es requerido' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO demo_executions (test_case_id, status, steps)
       VALUES ($1, 'running', '[]') RETURNING id`,
      [test_case_id]
    );
    res.status(201).json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Demo executions — actualizar resultado
app.patch('/api/demo/execution/:id', async (req, res) => {
  const { id } = req.params;
  const { status, result, steps } = req.body;
  try {
    await pool.query(
      `UPDATE demo_executions
       SET status=$1, result=$2, steps=$3, completed_at=NOW()
       WHERE id=$4`,
      [status, result, JSON.stringify(steps || []), id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Demo executions — consultar estado
app.get('/api/demo/execution/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const r = await pool.query(
      `SELECT * FROM demo_executions WHERE id=$1`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'no encontrado' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`AutoKore API corriendo en puerto ${PORT}`);
});
