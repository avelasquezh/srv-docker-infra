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

const listarConceptosCompra = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre FROM conceptos_compra ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar conceptos compra:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crearConceptoCompra = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const result = await pool.query(
      'INSERT INTO conceptos_compra (nombre) VALUES ($1) RETURNING *',
      [nombre.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'El concepto ya existe' });
    console.error('Error al crear concepto compra:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminarConceptoCompra = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM conceptos_compra WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al eliminar concepto compra:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const listarCategorias = async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM categorias ORDER BY nombre');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crearCategoria = async (req, res) => {
  const { nombre, slug } = req.body;
  if (!nombre || !slug) return res.status(400).json({ error: 'nombre y slug son requeridos' });
  try {
    const r = await pool.query(
      'INSERT INTO categorias (nombre, slug) VALUES ($1, $2) RETURNING *',
      [nombre.trim(), slug.trim().toLowerCase().replace(/\s+/g, '-')]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'El slug ya existe' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizarCategoria = async (req, res) => {
  const { id } = req.params;
  const { nombre, slug, activo } = req.body;
  try {
    const r = await pool.query(
      `UPDATE categorias SET
        nombre = COALESCE($1, nombre),
        slug   = COALESCE($2, slug),
        activo = COALESCE($3, activo)
       WHERE id = $4 RETURNING *`,
      [nombre || null, slug || null, activo ?? null, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'El slug ya existe' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminarCategoria = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM categorias WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listarOrigenes, crearOrigen, eliminarOrigen, listarConceptos, crearConcepto, eliminarConcepto, listarConceptosCompra, crearConceptoCompra, eliminarConceptoCompra, listarCategorias, crearCategoria, actualizarCategoria, eliminarCategoria };
