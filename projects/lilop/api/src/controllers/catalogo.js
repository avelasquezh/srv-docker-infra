const pool = require('../config/db');

const listar = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id, c.nombre, c.activo,
        c.descripcion, c.descripcion_corta,
        c.materiales, c.cuidados, c.tags,
        c.featured, c.badge, c.badge_tipo,
        c.categoria, c.categoria_label,
        c.precio_original,
        (
          SELECT json_agg(json_build_object('tamanio', p.tamanio, 'precio', p.precio, 'id', p.id) ORDER BY p.tamanio)
          FROM catalogo_precios p WHERE p.catalogo_id = c.id
        ) AS precios,
        (
          SELECT json_agg(json_build_object('id', d.id, 'nombre', d.nombre, 'imagen', d.imagen, 'estado', d.estado))
          FROM disenos d
          JOIN disenos_catalogo_productos dcp ON dcp.diseno_id = d.id
          WHERE dcp.catalogo_id = c.id AND d.imagen IS NOT NULL
        ) AS disenos
      FROM catalogo_productos c
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

const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const {
    nombre, descripcion, descripcion_corta, materiales, cuidados,
    tags, featured, badge, badge_tipo, categoria, categoria_label,
    precio_original,
  } = req.body;
  try {
    const result = await pool.query(`
      UPDATE catalogo_productos SET
        nombre            = COALESCE($1,  nombre),
        descripcion       = COALESCE($2,  descripcion),
        descripcion_corta = COALESCE($3,  descripcion_corta),
        materiales        = COALESCE($4,  materiales),
        cuidados          = COALESCE($5,  cuidados),
        tags              = COALESCE($6,  tags),
        featured          = COALESCE($7,  featured),
        badge             = COALESCE($8,  badge),
        badge_tipo        = COALESCE($9,  badge_tipo),
        categoria         = COALESCE($10, categoria),
        categoria_label   = COALESCE($11, categoria_label),
        precio_original   = COALESCE($12, precio_original)
      WHERE id = $13
      RETURNING *
    `, [
      nombre || null,
      descripcion || null, descripcion_corta || null,
      materiales ? JSON.stringify(materiales) : null,
      cuidados   ? JSON.stringify(cuidados)   : null,
      tags       ? JSON.stringify(tags)       : null,
      featured ?? null, badge || null, badge_tipo || null,
      categoria || null, categoria_label || null,
      precio_original || null, id,
    ]);
    if (!result.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar producto catálogo:', err.message);
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

const listarPublico = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id, c.nombre, c.activo,
        c.descripcion, c.descripcion_corta,
        c.materiales, c.cuidados, c.tags,
        c.featured, c.badge, c.badge_tipo,
        c.categoria, c.categoria_label,
        c.precio_original,
        (
          SELECT json_agg(json_build_object('tamanio', p.tamanio, 'precio', p.precio) ORDER BY p.tamanio)
          FROM catalogo_precios p WHERE p.catalogo_id = c.id
        ) AS precios,
        (
          SELECT json_agg(json_build_object('id', d.id, 'nombre', d.nombre, 'imagen', d.imagen))
          FROM disenos d
          JOIN disenos_catalogo_productos dcp ON dcp.diseno_id = d.id
          WHERE dcp.catalogo_id = c.id AND d.estado = 'Disponible' AND d.imagen IS NOT NULL
        ) AS disenos
      FROM catalogo_productos c
      WHERE c.activo = true
      ORDER BY c.featured DESC, c.nombre
    `);

    const productos = result.rows.map(c => {
      const precios = c.precios || [];
      const precioMin = precios.length
        ? Math.min(...precios.map(p => parseFloat(p.precio)))
        : 0;

      return {
        id:               c.id,
        name:             c.nombre,
        slug:             c.nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        price:            precioMin,
        originalPrice:    c.precio_original ? parseFloat(c.precio_original) : null,
        category:         c.categoria || 'general',
        categoryLabel:    c.categoria_label || c.nombre,
        description:      c.descripcion || '',
        shortDescription: c.descripcion_corta || '',
        materials:        c.materiales || [],
        care:             c.cuidados || [],
        variants: { Tamaño: precios.map(p => p.tamanio) },
        images:   (c.disenos || []).map(d => `https://api.lilop.store${d.imagen}`),
        featured:    c.featured,
        badge:       c.badge || null,
        badgeType:   c.badge_tipo || null,
        stock:       'available',
        rating:      0,
        reviewCount: 0,
        tags:        c.tags || [],
      };
    });

    res.set('Cache-Control', 'public, max-age=60');
    res.json(productos);
  } catch (err) {
    console.error('Error al listar catálogo público:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const eliminarProducto = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM catalogo_productos WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al eliminar producto catálogo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, upsertPrecio, crearProducto, actualizarProducto, toggleActivo, listarPublico, eliminarProducto };
