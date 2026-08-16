const pool = require('../config/db');

const listar = async (req, res) => {
  const { producto_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM compras WHERE producto_id = $1 ORDER BY created_at',
      [producto_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar compras:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const obtener = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM compras WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener compra:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crear = async (req, res) => {
  const { producto_id } = req.params;
  const { concepto, diseno, proveedor, cantidad, valor_unitario, fecha_compra, estado } = req.body;

  if (!cantidad || !valor_unitario) {
    return res.status(400).json({ error: 'Cantidad y valor unitario son requeridos' });
  }

  try {
    const producto = await pool.query(
      'SELECT id FROM productos WHERE id = $1',
      [producto_id]
    );
    if (producto.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const result = await pool.query(
      `INSERT INTO compras
         (producto_id, concepto, diseno, proveedor, cantidad, valor_unitario, fecha_compra, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        producto_id, concepto || null, diseno || null,
        proveedor || null, cantidad, valor_unitario,
        fecha_compra || null, estado || 'Pendiente'
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear compra:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizar = async (req, res) => {
  const { id } = req.params;
  const { concepto, diseno, proveedor, cantidad, valor_unitario, fecha_compra, estado } = req.body;

  try {
    const result = await pool.query(
      `UPDATE compras
       SET concepto       = COALESCE($1, concepto),
           diseno         = COALESCE($2, diseno),
           proveedor      = COALESCE($3, proveedor),
           cantidad       = COALESCE($4, cantidad),
           valor_unitario = COALESCE($5, valor_unitario),
           fecha_compra   = COALESCE($6, fecha_compra),
           estado         = COALESCE($7, estado)
       WHERE id = $8
       RETURNING *`,
      [concepto, diseno, proveedor, cantidad, valor_unitario, fecha_compra, estado, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar compra:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM compras WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    res.json({ mensaje: 'Compra eliminada correctamente' });
  } catch (err) {
    console.error('Error al eliminar compra:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
