const pool = require('../config/db');

const listar = async (req, res) => {
  try {
    const { vendedor_id, estado } = req.query;
    let query = `
      SELECT c.*, u.nombre AS vendedor, p.valor_venta, p.estado AS estado_pedido
      FROM comisiones c
      JOIN usuarios u ON u.id = c.vendedor_id
      JOIN pedidos  p ON p.id = c.pedido_id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;

    if (vendedor_id) { query += ` AND c.vendedor_id = $${i++}`; params.push(vendedor_id); }
    if (estado)      { query += ` AND c.estado = $${i++}`;      params.push(estado); }

    query += ' ORDER BY c.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar comisiones:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const obtener = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT c.*, u.nombre AS vendedor, p.valor_venta, p.estado AS estado_pedido
       FROM comisiones c
       JOIN usuarios u ON u.id = c.vendedor_id
       JOIN pedidos  p ON p.id = c.pedido_id
       WHERE c.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comisión no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener comisión:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const cambiarEstado = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!estado) {
    return res.status(400).json({ error: 'El estado es requerido' });
  }

  try {
    const result = await pool.query(
      `UPDATE comisiones SET estado = $1 WHERE id = $2
       RETURNING id, estado, valor_comision`,
      [estado, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comisión no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al cambiar estado de comisión:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const resumenVendedor = async (req, res) => {
  const { vendedor_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)                                          AS total_comisiones,
         SUM(valor_comision)                              AS total_valor,
         SUM(CASE WHEN estado = 'Pendiente' THEN valor_comision ELSE 0 END) AS pendiente,
         SUM(CASE WHEN estado = 'Pagada'    THEN valor_comision ELSE 0 END) AS pagado
       FROM comisiones
       WHERE vendedor_id = $1`,
      [vendedor_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener resumen:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, obtener, cambiarEstado, resumenVendedor };
