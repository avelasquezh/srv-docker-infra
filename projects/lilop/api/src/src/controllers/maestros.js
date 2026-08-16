const pool = require('../config/db');

/* ── ORÍGENES DE VENTA ── */
const listarOrigenes = async (req, res) => {
  try {
    const r = await pool.query('SELECT id, nombre FROM origenes_venta ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno del servidor' }); }
};
const crearOrigen = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const r = await pool.query('INSERT INTO origenes_venta (nombre) VALUES ($1) RETURNING *', [nombre.trim()]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'El origen ya existe' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
const eliminarOrigen = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM origenes_venta WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno del servidor' }); }
};

/* ── CONCEPTOS DE COSTO ── */
const listarConceptos = async (req, res) => {
  try {
    const r = await pool.query('SELECT id, nombre FROM conceptos_costo ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno del servidor' }); }
};
const crearConcepto = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const r = await pool.query('INSERT INTO conceptos_costo (nombre) VALUES ($1) RETURNING *', [nombre.trim()]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'El concepto ya existe' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
const eliminarConcepto = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM conceptos_costo WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno del servidor' }); }
};

module.exports = { listarOrigenes, crearOrigen, eliminarOrigen, listarConceptos, crearConcepto, eliminarConcepto };
