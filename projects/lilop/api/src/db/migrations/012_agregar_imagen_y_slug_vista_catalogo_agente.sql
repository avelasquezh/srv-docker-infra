-- ================================================================
-- 012_agregar_imagen_y_slug_vista_catalogo_agente.sql
--
-- Motivación: se quiere que el agente de WhatsApp pueda enviar
-- imágenes reales de los diseños disponibles, y armar el link del
-- catálogo filtrado por categoría (ej. https://lilop.store/catalogo.html
-- ?categoria=edredones). Validado contra el código real del repo antes
-- de escribir esto:
--
--   - `disenos.imagen` ya existe (ruta relativa tipo
--     /uploads/disenos/{timestamp}-{random}.webp, generada por
--     ImagenService.subir() en el dominio imagenes) pero
--     `vista_catalogo_agente` (ver 011) solo exponía `d.nombre` en
--     `disenos_disponibles` — la imagen no llegaba nunca al agente.
--   - `categorias.slug` ya existe y es lo que usa el propio sitio
--     (site/html/assets/js/pages/catalogo.js) para armar el link del
--     catálogo por categoría — pero `categorias` no está tracked en
--     ninguna migración anterior de este repo (se creó directo en
--     producción, mismo patrón ya documentado en 014_categorias_tipo
--     para la columna `tipo`). Esta migración asume que `slug` ya
--     existe en producción; si no existe, debe agregarse antes de
--     aplicar este archivo.
--
-- Cambios:
--   - `disenos_disponibles`: pasa de jsonb_agg(nombre) a
--     jsonb_agg(objeto con nombre + imagen). El campo `imagen` sale
--     tal cual está en la BD (ruta relativa, sin dominio) — el
--     llamador (n8n / prompt del agente) es responsable de anteponer
--     el dominio (https://api.lilop.store) antes de mandarlo a la
--     Meta Cloud API.
--   - `categorias`: pasa de jsonb_agg(nombre) a jsonb_agg(objeto con
--     nombre + slug), para que el agente pueda armar el link del
--     catálogo con el slug correcto en vez del nombre visible.
--
-- Sin impacto en `precios_por_tamanio` ni `adicionales` — no se tocan.
-- ================================================================

CREATE OR REPLACE VIEW vista_catalogo_agente AS
SELECT
    id,
    nombre,
    descripcion_corta,
    descripcion,
    tags,
    badge,
    ( SELECT jsonb_agg(jsonb_build_object('tamanio', v.atributos_resueltos->>'Tamaño', 'precio', v.precio) ORDER BY v.precio)
      FROM variantes v
      WHERE v.producto_id = cp.id
        AND v.atributos_resueltos - 'Tamaño' = '{}'::jsonb
        AND v.activo
    ) AS precios_por_tamanio,
    ( SELECT jsonb_agg(jsonb_build_object('nombre', var.nombre, 'tipo', var.tipo, 'sobreprecio', var.sobreprecio, 'opciones',
        ( SELECT jsonb_agg(jsonb_build_object('nombre', vv.valor, 'valor', vv.valor))
          FROM variable_valores vv
          WHERE vv.variable_id = var.id)))
      FROM producto_variables pv
      JOIN variables var ON var.id = pv.variable_id
      WHERE pv.producto_id = cp.id AND var.activo AND var.nombre <> 'Tamaño'
    ) AS adicionales,
    ( SELECT jsonb_agg(jsonb_build_object('nombre', c.nombre, 'slug', c.slug))
      FROM catalogo_productos_categorias cpc
      JOIN categorias c ON c.id = cpc.categoria_id
      WHERE cpc.catalogo_id = cp.id
    ) AS categorias,
    ( SELECT jsonb_agg(jsonb_build_object('nombre', d.nombre, 'imagen', d.imagen))
      FROM disenos_catalogo_productos dcp
      JOIN disenos d ON d.id = dcp.diseno_id
      WHERE dcp.catalogo_id = cp.id AND d.estado = 'Disponible'
    ) AS disenos_disponibles
FROM catalogo_productos cp
WHERE activo = true;

COMMENT ON VIEW vista_catalogo_agente IS
  'Catálogo pre-armado para el nodo de IA de n8n (consultado directo contra '
  'Postgres, no vía API). Desde 012: categorias trae nombre+slug (antes solo '
  'nombre) y disenos_disponibles trae nombre+imagen (antes solo nombre), '
  'para que el agente pueda enviar imágenes de diseño y armar el link del '
  'catálogo filtrado por categoría. precios_por_tamanio/adicionales sin '
  'cambios desde 009/011.';
