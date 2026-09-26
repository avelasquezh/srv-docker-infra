-- ================================================================
-- 014_meta_media_id_disenos.sql
--
-- Soporte para el patrón oficial de Meta para media reutilizado en
-- múltiples mensajes (mismo diseño enviado por WhatsApp a distintos
-- clientes a lo largo del tiempo): subir la imagen UNA vez al
-- endpoint /media de la Cloud API y reutilizar el media_id devuelto,
-- en vez de mandar "link" en cada envío (ver docs oficiales: "IDs
-- (recommended)" / "Links (not recommended)", y explícitamente:
-- "If the same link is reused for multiple messages it is
-- recommended to upload the media ... and reuse the relevant media
-- id for messaging").
--
-- El media_id expira a los 30 días desde que se subió (sin importar
-- uso), así que se guarda también la fecha de subida para poder
-- decidir, antes de cada envío, si hay que resubir la imagen.
--
-- Cambios:
--   1. `disenos.meta_media_id` y `disenos.meta_media_subido_en`:
--      cache del media_id vigente por diseño. NULL = nunca subido,
--      hay que subirlo antes del primer envío.
--   2. `vista_catalogo_agente.disenos_disponibles` ahora incluye
--      también el `id` del diseño (antes solo nombre/imagen/
--      principal) — necesario para que el sub-workflow de envío
--      pueda ubicar la fila exacta en `disenos` y hacer el
--      chequeo/actualización de media_id.
-- ================================================================

ALTER TABLE disenos
  ADD COLUMN IF NOT EXISTS meta_media_id text,
  ADD COLUMN IF NOT EXISTS meta_media_subido_en timestamptz;

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
    ( SELECT jsonb_agg(
        jsonb_build_object('id', d.id, 'nombre', d.nombre, 'imagen', d.imagen, 'principal', d.id = cp.diseno_principal_id)
        ORDER BY (d.id = cp.diseno_principal_id) DESC
      )
      FROM disenos_catalogo_productos dcp
      JOIN disenos d ON d.id = dcp.diseno_id
      WHERE dcp.catalogo_id = cp.id
        AND d.estado = 'Disponible'
        AND d.imagen IS NOT NULL
    ) AS disenos_disponibles
FROM catalogo_productos cp
WHERE activo = true;

COMMENT ON VIEW vista_catalogo_agente IS
  'Catálogo pre-armado para el nodo de IA de n8n (consultado directo contra '
  'Postgres, no vía API). Desde 014: disenos_disponibles incluye el id del '
  'diseño (para que el sub-workflow de envío ubique la fila en disenos y '
  'gestione su meta_media_id). categorias (slug, desde 012) y '
  'disenos_disponibles (sin NULL, orden por principal, desde 013) sin más '
  'cambios. precios_por_tamanio y adicionales sin cambios.';
