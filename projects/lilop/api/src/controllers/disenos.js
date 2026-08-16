'use strict';
const pool = require('../config/db');

const listar = async (req, res) => {
  try {
    const { catalogo_id } = req.query;
    let query = `
      SELECT d.id, d.nombre, d.catalogo, d.imagen, d.estado, d.created_at,
             COALESCE(array_agg(dcp.catalogo_id) FILTER (WHERE dcp.catalogo_id IS NOT NULL), '{}') AS catalogo_ids
      FROM disenos d
      LEFT JOIN disenos_catalogo_productos dcp ON dcp.diseno_id = d.id
    `;
    const params = [];
    if (catalogo_id) {
      query += ` WHERE d.id IN (SELECT diseno_id FROM disenos_catalogo_productos WHERE catalogo_id = $1)`;
      params.push(catalogo_id);
    }
    query += ' GROUP BY d.id ORDER BY d.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar diseños:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crear = async (req, res) => {
  const { nombre, catalogo, imagen, estado } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const result = await pool.query(
      `INSERT INTO disenos (nombre, catalogo, imagen, estado)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, catalogo, imagen, estado, created_at`,
      [nombre.trim(), catalogo || 'adulto_diseno', imagen || null, estado || 'Disponible']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear diseño:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre, catalogo, imagen, estado } = req.body;
  try {
    const result = await pool.query(
      `UPDATE disenos
       SET nombre     = COALESCE($1, nombre),
           catalogo  = COALESCE($2, catalogo),
           imagen     = COALESCE($3, imagen),
           estado     = COALESCE($4, estado),
           updated_at = now()
       WHERE id = $5
       RETURNING id, nombre, catalogo, imagen, estado, created_at`,
      [nombre?.trim() || null, catalogo || null, imagen || null, estado || null, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Diseño no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar diseño:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM disenos WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Diseño no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al eliminar diseño:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const listarProductosDiseno = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT cp.id, cp.nombre FROM disenos_catalogo_productos dcp
       JOIN catalogo_productos cp ON cp.id = dcp.catalogo_id
       WHERE dcp.diseno_id = $1 ORDER BY cp.nombre`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar productos del diseño:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizarProductosDiseno = async (req, res) => {
  const { id } = req.params;
  const { catalogo_ids } = req.body;
  if (!Array.isArray(catalogo_ids)) {
    return res.status(400).json({ error: 'catalogo_ids debe ser un array' });
  }
  try {
    await pool.query('DELETE FROM disenos_catalogo_productos WHERE diseno_id = $1', [id]);
    if (catalogo_ids.length) {
      const values = catalogo_ids.map((cid, i) => `($1, $${i + 2})`).join(',');
      await pool.query(
        `INSERT INTO disenos_catalogo_productos (diseno_id, catalogo_id) VALUES ${values}`,
        [id, ...catalogo_ids]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al actualizar productos del diseño:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, crear, actualizar, eliminar, listarProductosDiseno, actualizarProductosDiseno };
