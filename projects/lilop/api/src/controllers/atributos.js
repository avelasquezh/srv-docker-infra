'use strict';
const pool = require('../config/db');

const listar = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, 
        json_agg(json_build_object('id', o.id, 'nombre', o.nombre, 'valor', o.valor) ORDER BY o.id)
        FILTER (WHERE o.id IS NOT NULL) AS opciones
      FROM atributos a
      LEFT JOIN atributo_opciones o ON o.atributo_id = a.id
      GROUP BY a.id ORDER BY a.nombre
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar atributos:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crear = async (req, res) => {
  const { nombre, tipo, sobreprecio } = req.body;
  if (!nombre || !tipo) return res.status(400).json({ error: 'nombre y tipo son requeridos' });
  try {
    const result = await pool.query(
      'INSERT INTO atributos (nombre, tipo, sobreprecio) VALUES ($1, $2, $3) RETURNING *',
      [nombre.trim(), tipo, parseFloat(sobreprecio) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'El atributo ya existe' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre, sobreprecio, activo } = req.body;
  try {
    const result = await pool.query(
      `UPDATE atributos SET
        nombre      = COALESCE($1, nombre),
        sobreprecio = COALESCE($2, sobreprecio),
        activo      = COALESCE($3, activo)
       WHERE id = $4 RETURNING *`,
      [nombre || null, sobreprecio !== undefined ? parseFloat(sobreprecio) : null, activo ?? null, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Atributo no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM atributos WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crearOpcion = async (req, res) => {
  const { id } = req.params;
  const { nombre, valor } = req.body;
  if (!nombre || !valor) return res.status(400).json({ error: 'nombre y valor son requeridos' });
  try {
    const result = await pool.query(
      'INSERT INTO atributo_opciones (atributo_id, nombre, valor) VALUES ($1, $2, $3) RETURNING *',
      [id, nombre.trim(), valor.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'La opción ya existe' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminarOpcion = async (req, res) => {
  const { opcionId } = req.params;
  try {
    await pool.query('DELETE FROM atributo_opciones WHERE id = $1', [opcionId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const listarPorProducto = async (req, res) => {
  const { catalogo_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT a.*,
        json_agg(json_build_object('id', o.id, 'nombre', o.nombre, 'valor', o.valor) ORDER BY o.id)
        FILTER (WHERE o.id IS NOT NULL) AS opciones
      FROM atributos a
      JOIN catalogo_atributos ca ON ca.atributo_id = a.id
      LEFT JOIN atributo_opciones o ON o.atributo_id = a.id
      WHERE ca.catalogo_id = $1
      GROUP BY a.id ORDER BY a.nombre
    `, [catalogo_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizarAtributosProducto = async (req, res) => {
  const { catalogo_id } = req.params;
  const { atributo_ids } = req.body;
  if (!Array.isArray(atributo_ids)) return res.status(400).json({ error: 'atributo_ids debe ser array' });
  try {
    await pool.query('DELETE FROM catalogo_atributos WHERE catalogo_id = $1', [catalogo_id]);
    if (atributo_ids.length) {
      const vals = atributo_ids.map((_, i) => `($1, $${i+2})`).join(',');
      await pool.query(
        `INSERT INTO catalogo_atributos (catalogo_id, atributo_id) VALUES ${vals}`,
        [catalogo_id, ...atributo_ids]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, crear, actualizar, eliminar, crearOpcion, eliminarOpcion, listarPorProducto, actualizarAtributosProducto };
