const pool = require('../config/db');

const listar = async (req, res) => {
  const { pedido_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM productos WHERE pedido_id = $1 ORDER BY created_at',
      [pedido_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar productos:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const obtener = async (req, res) => {
  const { id } = req.params;
  try {
    const producto = await pool.query(
      'SELECT * FROM productos WHERE id = $1',
      [id]
    );
    if (producto.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const compras = await pool.query(
      'SELECT * FROM compras WHERE producto_id = $1 ORDER BY created_at',
      [id]
    );

    res.json({
      ...producto.rows[0],
      compras: compras.rows,
    });
  } catch (err) {
    console.error('Error al obtener producto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const crear = async (req, res) => {
  const { pedido_id } = req.params;
  const { nombre, tamanio, diseno, estado, cantidad } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del producto es requerido' });
  }

  try {
    const pedido = await pool.query(
      'SELECT id FROM pedidos WHERE id = $1',
      [pedido_id]
    );
    if (pedido.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const precioResult = await pool.query(
      `SELECT cp.precio
       FROM catalogo_productos cat
       JOIN catalogo_precios cp ON cp.catalogo_id = cat.id AND cp.tamanio = $2
       WHERE cat.nombre = $1
       LIMIT 1`,
      [nombre, tamanio || null]
    );
    const cant = parseInt(cantidad) || 1;
    const precioBase = precioResult.rows[0]?.precio ? precioResult.rows[0].precio * cant : null;

    const result = await pool.query(
      `INSERT INTO productos (pedido_id, nombre, tamanio, diseno, estado, valor_venta_override, cantidad)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [pedido_id, nombre, tamanio || null, diseno || null, estado || 'Por Comprar', precioBase, cant]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear producto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre, tamanio, diseno, estado, valor_venta_override, cantidad } = req.body;

  try {
    let overrideFinal = valor_venta_override !== undefined ? valor_venta_override : null;

    if (overrideFinal === null) {
      const prod = (await pool.query('SELECT nombre, tamanio, cantidad FROM productos WHERE id = $1', [id])).rows[0];
      const nombreFinal   = nombre  || prod?.nombre;
      const tamanioFinal  = tamanio || prod?.tamanio;
      const cantidadFinal = parseInt(cantidad) || prod?.cantidad || 1;
      const precioResult = await pool.query(
        `SELECT cp.precio
         FROM catalogo_productos cat
         JOIN catalogo_precios cp ON cp.catalogo_id = cat.id AND cp.tamanio = $2
         WHERE cat.nombre = $1
         LIMIT 1`,
        [nombreFinal, tamanioFinal]
      );
      overrideFinal = precioResult.rows[0]?.precio ? precioResult.rows[0].precio * cantidadFinal : null;
    }

    const result = await pool.query(
      `UPDATE productos
       SET nombre               = COALESCE($1, nombre),
           tamanio              = COALESCE($2, tamanio),
           diseno               = COALESCE($3, diseno),
           estado               = COALESCE($4, estado),
           valor_venta_override = $5,
           cantidad             = COALESCE($6, cantidad)
       WHERE id = $7
       RETURNING *`,
      [nombre, tamanio, diseno, estado, overrideFinal, cantidad || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar producto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM productos WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Producto eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar producto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };


const catalogo = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT nombre FROM catalogo_productos WHERE activo = true ORDER BY nombre"
    );
    res.json(result.rows.map(r => r.nombre));
  } catch (err) {
    console.error('Error al obtener catálogo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar, catalogo };
