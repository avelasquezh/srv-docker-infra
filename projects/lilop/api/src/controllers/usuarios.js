const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const toTitleCase = str =>
  str && str.trim().replace(/\b\w/g, c => c.toUpperCase());

const listar = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, celular, email, rol, comision_pct, activo, created_at FROM usuarios ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar usuarios:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const obtener = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, nombre, celular, email, rol, comision_pct, activo, created_at FROM usuarios WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener usuario:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crear = async (req, res) => {
  const { nombre: _nombre, celular, email, password, rol, comision_pct } = req.body;
  const nombre = toTitleCase(_nombre);

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, celular, email, password, rol, comision_pct)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, celular, email, rol, comision_pct, activo`,
      [nombre, celular || null, email, hash, rol || 'vendedor', comision_pct ?? 20]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    console.error('Error al crear usuario:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre: _nombre, celular, email, rol, comision_pct, activo } = req.body;
  const nombre = toTitleCase(_nombre);

  try {
    const result = await pool.query(
      `UPDATE usuarios
       SET nombre       = COALESCE($1, nombre),
           celular      = COALESCE($2, celular),
           email        = COALESCE($3, email),
           rol          = COALESCE($4, rol),
           comision_pct = COALESCE($5, comision_pct),
           activo       = COALESCE($6, activo)
       WHERE id = $7
       RETURNING id, nombre, celular, email, rol, comision_pct, activo`,
      [nombre, celular, email, rol, comision_pct, activo, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    console.error('Error al actualizar usuario:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const cambiarPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'La contraseña es requerida' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'UPDATE usuarios SET password = $1 WHERE id = $2 RETURNING id',
      [hash, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error al cambiar contraseña:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE usuarios SET activo = false WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Usuario desactivado correctamente' });
  } catch (err) {
    console.error('Error al eliminar usuario:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, obtener, crear, actualizar, cambiarPassword, eliminar };
