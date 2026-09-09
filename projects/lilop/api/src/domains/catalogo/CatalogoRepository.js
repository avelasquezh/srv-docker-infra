const BaseRepository = require('../../core/BaseRepository');

const SELECT_ADMIN = `
  SELECT
    c.id, c.nombre, c.activo,
    c.descripcion, c.descripcion_corta,
    c.materiales, c.cuidados, c.tags,
    c.featured, c.badge, c.badge_tipo,
    c.precio_original, c.diseno_principal_id,
    (
      SELECT json_agg(json_build_object('tamanio', vt.atributos_resueltos->>'Tamaño', 'precio', vt.precio, 'id', vt.id) ORDER BY vt.atributos_resueltos->>'Tamaño')
      FROM variantes vt
      WHERE vt.producto_id = c.id AND vt.activo = true
        AND vt.atributos_resueltos - 'Tamaño' = '{}'::jsonb
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
          SELECT json_agg(json_build_object('tamanio', vt.atributos_resueltos->>'Tamaño', 'precio', vt.precio) ORDER BY vt.atributos_resueltos->>'Tamaño')
          FROM variantes vt
          WHERE vt.producto_id = c.id AND vt.activo = true
            AND vt.atributos_resueltos - 'Tamaño' = '{}'::jsonb
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

  /**
   * Devuelve el id de la variable "Tamaño" (única, compartida por todo
   * el catálogo — ver migración 002). Si por algún motivo no existiera
   * (no debería pasar, la crea el backfill inicial), la crea.
   */
  async _obtenerVariableTamanio() {
    const { rows } = await this.query(`SELECT id FROM variables WHERE nombre = 'Tamaño'`);
    if (rows[0]) return rows[0].id;
    const { rows: nuevo } = await this.query(
      `INSERT INTO variables (nombre, tipo) VALUES ('Tamaño', 'lista') RETURNING id`
    );
    return nuevo[0].id;
  }

  /** Id del variable_valor para ese texto de tamaño, creándolo si no existe. */
  async _obtenerOCrearValorTamanio(variableId, tamanio) {
    const { rows } = await this.query(
      'SELECT id FROM variable_valores WHERE variable_id = $1 AND valor = $2',
      [variableId, tamanio]
    );
    if (rows[0]) return rows[0].id;
    const { rows: nuevo } = await this.query(
      'INSERT INTO variable_valores (variable_id, valor) VALUES ($1, $2) RETURNING id',
      [variableId, tamanio]
    );
    return nuevo[0].id;
  }

  /** Asegura que el producto tenga ese tamaño habilitado en producto_variables. */
  async _asegurarValorPermitido(productoId, variableId, valorId) {
    const { rows } = await this.query(
      'SELECT valores_permitidos FROM producto_variables WHERE producto_id = $1 AND variable_id = $2',
      [productoId, variableId]
    );
    if (!rows.length) {
      await this.query(
        'INSERT INTO producto_variables (producto_id, variable_id, valores_permitidos) VALUES ($1, $2, ARRAY[$3]::text[])',
        [productoId, variableId, valorId]
      );
    } else if (!(rows[0].valores_permitidos || []).includes(valorId)) {
      await this.query(
        `UPDATE producto_variables SET valores_permitidos = array_append(valores_permitidos, $3)
         WHERE producto_id = $1 AND variable_id = $2`,
        [productoId, variableId, valorId]
      );
    }
  }

  /**
   * Crea/actualiza el precio de un tamaño para un producto — ahora contra
   * `variantes` (Fase 5 ya cortada), no contra `catalogo_precios`. Mismo
   * comportamiento exacto que antes:
   *   - precio <= 0 => elimina el tamaño de ese producto (antes: DELETE de
   *     catalogo_precios; ahora: DELETE de la variante base de ese tamaño).
   *   - si no, crea o actualiza la variante base (mismo criterio de
   *     "atributos_resueltos = solo Tamaño" que usa el trigger desacoplado
   *     en 008, para que el cálculo de pedidos.valor_venta y este admin
   *     nunca queden desincronizados).
   * Además, a diferencia del esquema viejo (donde la fila de precio ERA
   * el habilitador del tamaño), acá hay que asegurar por separado que el
   * tamaño quede habilitado en producto_variables — se hace siempre,
   * created o actualizado, sin costo si ya estaba.
   */
  async upsertPrecio(catalogoId, { tamanio, precio }) {
    const varTamanioId = await this._obtenerVariableTamanio();
    const valorId = await this._obtenerOCrearValorTamanio(varTamanioId, tamanio);

    if (parseFloat(precio) <= 0) {
      await this.query(
        `DELETE FROM variantes WHERE producto_id = $1 AND atributos_resueltos = jsonb_build_object('Tamaño', $2::text)`,
        [catalogoId, tamanio]
      );
      return { ok: true, eliminado: true };
    }

    await this._asegurarValorPermitido(catalogoId, varTamanioId, valorId);

    const sku = `${catalogoId}-${tamanio}`.toUpperCase().replace(/\s+/g, '-');
    const { rows } = await this.query(
      `INSERT INTO variantes (producto_id, valores, precio, sku)
       VALUES ($1, jsonb_build_object($2::text, $3::text), $4, $5)
       ON CONFLICT (sku) DO UPDATE SET
         precio = $4,
         valores = jsonb_build_object($2::text, $3::text),
         activo = true,
         updated_at = now()
       RETURNING id, producto_id, atributos_resueltos, precio`,
      [catalogoId, varTamanioId, valorId, precio, sku]
    );
    const v = rows[0];
    // Mismo shape que devolvía la fila de catalogo_precios: {id, catalogo_id, tamanio, precio}
    return { id: v.id, catalogo_id: v.producto_id, tamanio: v.atributos_resueltos?.Tamaño, precio: v.precio };
  }
}

module.exports = CatalogoRepository;
