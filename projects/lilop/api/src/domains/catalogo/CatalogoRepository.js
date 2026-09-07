const BaseRepository = require('../../core/BaseRepository');

const SELECT_ADMIN = `
  SELECT
    c.id, c.nombre, c.activo,
    c.descripcion, c.descripcion_corta,
    c.materiales, c.cuidados, c.tags,
    c.featured, c.badge, c.badge_tipo,
    c.precio_original, c.diseno_principal_id,
    (
      SELECT json_agg(json_build_object('tamanio', p.tamanio, 'precio', p.precio, 'id', p.id) ORDER BY p.tamanio)
      FROM catalogo_precios p WHERE p.catalogo_id = c.id
    ) AS precios,
    (
      SELECT json_agg(json_build_object('id', d.id, 'nombre', d.nombre, 'imagen', d.imagen, 'estado', d.estado) ORDER BY (d.id = c.diseno_principal_id) DESC)
      FROM disenos d
      JOIN disenos_catalogo_productos dcp ON dcp.diseno_id = d.id
      WHERE dcp.catalogo_id = c.id AND d.imagen IS NOT NULL
    ) AS disenos,
    (
      SELECT json_agg(json_build_object('id', cat.id, 'nombre', cat.nombre, 'slug', cat.slug))
      FROM categorias cat
      JOIN catalogo_productos_categorias cpc ON cpc.categoria_id = cat.id
      WHERE cpc.catalogo_id = c.id
    ) AS categorias,
    (
      SELECT json_agg(json_build_object('id', a.id, 'nombre', a.nombre, 'tipo', a.tipo, 'sobreprecio', a.sobreprecio))
      FROM atributos a
      JOIN catalogo_atributos ca ON ca.atributo_id = a.id
      WHERE ca.catalogo_id = c.id
    ) AS atributos
  FROM catalogo_productos c
`;

/**
 * CatalogoRepository — acceso a datos del catálogo de productos
 * (`catalogo_productos`/`catalogo_precios` + relaciones a
 * `categorias`/`disenos`/`atributos`). Mismo alcance que anunció
 * Agente Negro: solo el envoltorio POO sobre el esquema legacy tal
 * cual existe hoy — no se toca el esquema ni se hace el corte de
 * Fase 5 (eso queda para cuando se resuelva la dependencia con
 * `pedidos`, ver sección 7ter del MD).
 */
class CatalogoRepository extends BaseRepository {
  async listar() {
    const { rows } = await this.query(`${SELECT_ADMIN} ORDER BY c.nombre`);
    return rows;
  }

  async listarPublicoRaw() {
    const { rows } = await this.query(`
      SELECT
        c.id, c.nombre, c.activo,
        c.descripcion, c.descripcion_corta,
        c.materiales, c.cuidados, c.tags,
        c.featured, c.badge, c.badge_tipo,
        c.precio_original, c.diseno_principal_id,
        (
          SELECT json_agg(json_build_object('tamanio', p.tamanio, 'precio', p.precio) ORDER BY p.tamanio)
          FROM catalogo_precios p WHERE p.catalogo_id = c.id
        ) AS precios,
        (
          SELECT json_agg(json_build_object('id', d.id, 'nombre', d.nombre, 'imagen', d.imagen) ORDER BY (d.id = c.diseno_principal_id) DESC)
          FROM disenos d
          JOIN disenos_catalogo_productos dcp ON dcp.diseno_id = d.id
          WHERE dcp.catalogo_id = c.id AND d.estado = 'Disponible' AND d.imagen IS NOT NULL
        ) AS disenos,
        (
          SELECT json_agg(json_build_object('id', cat.id, 'nombre', cat.nombre, 'slug', cat.slug))
          FROM categorias cat
          JOIN catalogo_productos_categorias cpc ON cpc.categoria_id = cat.id
          WHERE cpc.catalogo_id = c.id
        ) AS categorias,
        (
          SELECT json_agg(json_build_object('id', a.id, 'nombre', a.nombre, 'tipo', a.tipo, 'sobreprecio', a.sobreprecio))
          FROM atributos a
          JOIN catalogo_atributos ca ON ca.atributo_id = a.id
          WHERE ca.catalogo_id = c.id
        ) AS atributos
      FROM catalogo_productos c
      WHERE c.activo = true
      ORDER BY c.featured DESC, c.nombre
    `);
    return rows;
  }

  async crear({ nombre }) {
    const { rows } = await this.query('INSERT INTO catalogo_productos (nombre) VALUES ($1) RETURNING *', [nombre]);
    return rows[0];
  }

  async actualizar(id, datos) {
    const {
      nombre, descripcion, descripcion_corta, materiales, cuidados,
      tags, featured, badge, badge_tipo, precio_original,
      categoria_ids, diseno_ids, diseno_principal_id,
    } = datos;

    const { rows } = await this.query(`
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
        precio_original   = COALESCE($10, precio_original),
        diseno_principal_id = COALESCE($11, diseno_principal_id)
      WHERE id = $12
      RETURNING *
    `, [
      nombre || null,
      descripcion || null, descripcion_corta || null,
      materiales ? JSON.stringify(materiales) : null,
      cuidados   ? JSON.stringify(cuidados)   : null,
      tags       ? JSON.stringify(tags)       : null,
      featured ?? null, badge || null, badge_tipo || null,
      precio_original || null, diseno_principal_id || null, id,
    ]);
    if (!rows.length) return null;

    if (Array.isArray(categoria_ids)) {
      await this.query('DELETE FROM catalogo_productos_categorias WHERE catalogo_id = $1', [id]);
      if (categoria_ids.length) {
        const vals = categoria_ids.map((_, i) => `($1, $${i + 2})`).join(',');
        await this.query(
          `INSERT INTO catalogo_productos_categorias (catalogo_id, categoria_id) VALUES ${vals}`,
          [id, ...categoria_ids]
        );
      }
    }
    if (Array.isArray(diseno_ids)) {
      await this.query('DELETE FROM disenos_catalogo_productos WHERE catalogo_id = $1', [id]);
      if (diseno_ids.length) {
        const valsD = diseno_ids.map((_, i) => `($${i + 2}, $1)`).join(',');
        await this.query(
          `INSERT INTO disenos_catalogo_productos (diseno_id, catalogo_id) VALUES ${valsD}`,
          [id, ...diseno_ids]
        );
      }
    }
    return rows[0];
  }

  async toggleActivo(id) {
    const { rows } = await this.query('UPDATE catalogo_productos SET activo = NOT activo WHERE id = $1 RETURNING *', [id]);
    return rows[0] || null;
  }

  async eliminar(id) {
    const { rows } = await this.query('DELETE FROM catalogo_productos WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  }

  async upsertPrecio(catalogoId, { tamanio, precio }) {
    if (parseFloat(precio) <= 0) {
      await this.query('DELETE FROM catalogo_precios WHERE catalogo_id = $1 AND tamanio = $2', [catalogoId, tamanio]);
      return { ok: true, eliminado: true };
    }
    const { rows } = await this.query(`
      INSERT INTO catalogo_precios (catalogo_id, tamanio, precio)
      VALUES ($1, $2, $3)
      ON CONFLICT (catalogo_id, tamanio)
      DO UPDATE SET precio = $3, updated_at = now()
      RETURNING *
    `, [catalogoId, tamanio, precio]);
    return rows[0];
  }
}

module.exports = CatalogoRepository;
