const pool = require('../config/db');

const toTitleCase = str =>
  str && str.trim().replace(/\b\w/g, c => c.toUpperCase());

const listar = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        COUNT(DISTINCT p.id)::int AS total_pedidos,
        COALESCE((
          SELECT SUM(pr.valor_venta_override)
          FROM pedidos p2
          JOIN productos pr ON pr.pedido_id = p2.id
          WHERE p2.cliente_id = c.id
            AND pr.valor_venta_override IS NOT NULL
        ), 0) AS total_gastado
      FROM clientes c
      LEFT JOIN pedidos p ON p.cliente_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar clientes:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const obtener = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM clientes WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener cliente:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crear = async (req, res) => {
  const { nombre: _nombre, celular, departamento, ciudad, localidad, barrio, direccion, origen_venta } = req.body;
  const nombre = toTitleCase(_nombre);
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO clientes (nombre, celular, departamento, ciudad, localidad, barrio, direccion, origen_venta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [nombre, celular || null, departamento || null, ciudad || null, localidad || null,
       barrio || null, direccion || null, origen_venta || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear cliente:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre: _nombre, celular, departamento, ciudad, localidad, barrio, direccion, origen_venta } = req.body;
  const nombre = toTitleCase(_nombre);
  try {
    if (celular) {
      const existe = await pool.query(
        'SELECT id FROM clientes WHERE celular = $1 AND id != $2', [celular, id]
      );
      if (existe.rows.length > 0) {
        return res.status(409).json({ error: `El celular ${celular} ya está registrado` });
      }
    }
    const result = await pool.query(
      `UPDATE clientes
       SET nombre        = COALESCE($1, nombre),
           celular       = COALESCE($2, celular),
           departamento  = COALESCE($3, departamento),
           ciudad        = COALESCE($4, ciudad),
           localidad     = COALESCE($5, localidad),
           barrio        = COALESCE($6, barrio),
           direccion     = COALESCE($7, direccion),
           origen_venta  = COALESCE($8, origen_venta),
           updated_at    = now()
       WHERE id = $9
       RETURNING *`,
      [nombre, celular, departamento, ciudad, localidad, barrio, direccion, origen_venta, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar cliente:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const pedidos = await pool.query(
      'SELECT id FROM pedidos WHERE cliente_id = $1 LIMIT 1',
      [id]
    );
    if (pedidos.rows.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar un cliente con pedidos registrados' });
    }
    const result = await pool.query(
      'DELETE FROM clientes WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json({ mensaje: 'Cliente eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar cliente:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const pedidos = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM pedidos WHERE cliente_id = $1 ORDER BY fecha_venta DESC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener pedidos del cliente:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const listaOrigenes = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT nombre FROM origenes_venta ORDER BY nombre"
    );
    res.json(result.rows.map(r => r.nombre));
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
module.exports = { listar, obtener, crear, actualizar, eliminar, pedidos, listaOrigenes };