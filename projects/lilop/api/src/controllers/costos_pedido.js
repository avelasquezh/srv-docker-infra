const pool = require('../config/db');

const listar = async (req, res) => {
  const { pedido_id } = req.params;
  try {
    const [costos, entregas, comision] = await Promise.all([
      pool.query('SELECT * FROM costos_pedido WHERE pedido_id = $1 ORDER BY created_at', [pedido_id]),
      pool.query('SELECT * FROM entregas WHERE pedido_id = $1 ORDER BY created_at', [pedido_id]),
      pool.query('SELECT * FROM comisiones WHERE pedido_id = $1 ORDER BY created_at', [pedido_id]),
    ]);
    res.json({
      otros:     costos.rows,
      domicilio: entregas.rows,
      comision:  comision.rows,
    });
  } catch (err) {
    console.error('Error al listar costos:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const agregarDomicilio = async (req, res) => {
  const { pedido_id } = req.params;
  const { valor_domicilio, domiciliario, notas } = req.body;
  if (!valor_domicilio) return res.status(400).json({ error: 'El valor del domicilio es requerido' });
  try {
    const entrega = await pool.query(
      `INSERT INTO entregas (pedido_id, valor_domicilio, domiciliario, notas)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [pedido_id, valor_domicilio, domiciliario || null, notas || null]
    );
    await pool.query(
      `UPDATE pedidos SET valor_domicilio = (
        SELECT COALESCE(SUM(valor_domicilio), 0) FROM entregas WHERE pedido_id = $1
       ) WHERE id = $1`, [pedido_id]
    );
    res.status(201).json(entrega.rows[0]);
  } catch (err) {
    console.error('Error al agregar domicilio:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const agregarComision = async (req, res) => {
  const { pedido_id } = req.params;
  const { valor_comision, nombre_vendedor } = req.body;
  console.log('agregarComision body:', req.body);
  if (!valor_comision) return res.status(400).json({ error: 'El valor de la comisión es requerido' });
  try {
    await pool.query(
      'INSERT INTO comisiones (pedido_id, nombre_vendedor, valor_comision) VALUES ($1, $2, $3)',
      [pedido_id, nombre_vendedor || null, valor_comision]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al agregar comisión:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const agregarOtro = async (req, res) => {
  const { pedido_id } = req.params;
  const { nombre, valor } = req.body;
  if (!nombre || !valor) return res.status(400).json({ error: 'nombre y valor son requeridos' });
  try {
    const result = await pool.query(
      `INSERT INTO costos_pedido (pedido_id, nombre, valor) VALUES ($1, $2, $3) RETURNING *`,
      [pedido_id, nombre, valor]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al agregar costo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminarOtro = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM costos_pedido WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al eliminar costo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminarDomicilio = async (req, res) => {
  const { pedido_id, id } = req.params;
  try {
    await pool.query('DELETE FROM entregas WHERE id = $1', [id]);
    await pool.query(
      `UPDATE pedidos SET valor_domicilio = (
        SELECT COALESCE(SUM(valor_domicilio), 0) FROM entregas WHERE pedido_id = $1
       ) WHERE id = $1`, [pedido_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al eliminar domicilio:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminarComision = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM comisiones WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al eliminar comisión:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const listaDomiciliarios = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT domiciliario FROM entregas WHERE domiciliario IS NOT NULL ORDER BY domiciliario"
    );
    res.json(result.rows.map(r => r.domiciliario));
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const listaVendedoresComision = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT nombre_vendedor FROM comisiones WHERE nombre_vendedor IS NOT NULL ORDER BY nombre_vendedor"
    );
    res.json(result.rows.map(r => r.nombre_vendedor));
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const listaConceptosOtros = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT nombre FROM costos_pedido WHERE nombre IS NOT NULL ORDER BY nombre"
    );
    res.json(result.rows.map(r => r.nombre));
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
module.exports = { listar, agregarDomicilio, agregarComision, eliminarComision, agregarOtro, eliminarOtro, eliminarDomicilio, listaDomiciliarios, listaVendedoresComision, listaConceptosOtros };
