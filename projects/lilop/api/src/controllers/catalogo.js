const pool = require('../config/db');

const listar = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id, c.nombre, c.activo,
        json_agg(
          json_build_object('tamanio', p.tamanio, 'precio', p.precio, 'id', p.id)
          ORDER BY p.tamanio
        ) FILTER (WHERE p.id IS NOT NULL) AS precios
      FROM catalogo_productos c
      LEFT JOIN catalogo_precios p ON p.catalogo_id = c.id
      GROUP BY c.id, c.nombre, c.activo
      ORDER BY c.nombre
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar catálogo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const upsertPrecio = async (req, res) => {
  const { catalogo_id } = req.params;
  const { tamanio, precio } = req.body;
  if (!tamanio || precio === undefined) {
    return res.status(400).json({ error: 'tamanio y precio son requeridos' });
  }
  try {
    const result = await pool.query(`
      INSERT INTO catalogo_precios (catalogo_id, tamanio, precio)
      VALUES ($1, $2, $3)
      ON CONFLICT (catalogo_id, tamanio)
      DO UPDATE SET precio = $3, updated_at = now()
      RETURNING *
    `, [catalogo_id, tamanio, precio]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al guardar precio:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crearProducto = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const result = await pool.query(
      'INSERT INTO catalogo_productos (nombre) VALUES ($1) RETURNING *', [nombre]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear producto catálogo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const toggleActivo = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE catalogo_productos SET activo = NOT activo WHERE id = $1 RETURNING *', [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar catálogo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, upsertPrecio, crearProducto, toggleActivo };
