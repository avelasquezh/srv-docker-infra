const pool = require('../config/db');

const listar = async (req, res) => {
  const { pedido_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM entregas WHERE pedido_id = $1 ORDER BY created_at',
      [pedido_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar entregas:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const obtener = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM entregas WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entrega no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener entrega:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crear = async (req, res) => {
  const { pedido_id } = req.params;
  const { fecha_entrega, valor_domicilio, domiciliario, estado, notas } = req.body;

  try {
    const pedido = await pool.query(
      'SELECT id FROM pedidos WHERE id = $1',
      [pedido_id]
    );
    if (pedido.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const result = await pool.query(
      `INSERT INTO entregas (pedido_id, fecha_entrega, valor_domicilio, domiciliario, estado, notas)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        pedido_id, fecha_entrega || null, valor_domicilio || 0,
        domiciliario || null, estado || 'Pendiente', notas || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear entrega:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizar = async (req, res) => {
  const { id } = req.params;
  const { fecha_entrega, valor_domicilio, domiciliario, estado, notas } = req.body;

  try {
    const result = await pool.query(
      `UPDATE entregas
       SET fecha_entrega   = COALESCE($1, fecha_entrega),
           valor_domicilio = COALESCE($2, valor_domicilio),
           domiciliario    = COALESCE($3, domiciliario),
           estado          = COALESCE($4, estado),
           notas           = COALESCE($5, notas)
       WHERE id = $6
       RETURNING *`,
      [fecha_entrega, valor_domicilio, domiciliario, estado, notas, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entrega no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar entrega:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM entregas WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entrega no encontrada' });
    }
    res.json({ mensaje: 'Entrega eliminada correctamente' });
  } catch (err) {
    console.error('Error al eliminar entrega:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
