-- ================================================================
-- 013_fix_disenos_disponibles_imagen_null_y_principal.sql
--
-- Corrige dos gaps de 012 detectados al comparar contra el patrón ya
-- usado en CatalogoRepository.js (listar/listarPublicoRaw) para el
-- catálogo del sitio:
--
--   1. `d.imagen` puede ser NULL (diseños creados sin imagen subida
--      todavía). El catálogo público ya filtra esto con
--      `AND d.imagen IS NOT NULL`; 012 no lo tenía, así que el agente
--      podía recibir objetos con "imagen": null e intentar mandarlos
--      a la Meta Cloud API, lo cual falla.
--   2. `catalogo_productos.diseno_principal_id` ya se usa en el resto
--      del sistema para decidir qué diseño mostrar primero
--      (`ORDER BY (d.id = c.diseno_principal_id) DESC`). 012 no lo
--      reproducía, así que el agente no tenía forma de saber cuál
--      diseño es el "por defecto" del producto. Se agrega el mismo
--      orden, más un flag `principal` explícito en cada objeto para
--      que el agente (o la tool que arma la selección de imágenes)
--      no tenga que adivinarlo comparando IDs.
--
-- Solo se toca `disenos_disponibles`. `categorias` (con slug, desde
-- 012), `precios_por_tamanio` y `adicionales` no cambian.
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
    ( SELECT jsonb_agg(
        jsonb_build_object('nombre', d.nombre, 'imagen', d.imagen, 'principal', d.id = cp.diseno_principal_id)
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
  'Postgres, no vía API). Desde 013: disenos_disponibles excluye diseños sin '
  'imagen (d.imagen IS NOT NULL) y viene ordenado con el diseño principal '
  '(catalogo_productos.diseno_principal_id) primero, con flag "principal" '
  'explícito por objeto — mismo criterio que ya usa el catálogo público del '
  'sitio (CatalogoRepository). categorias (con slug, desde 012), '
  'precios_por_tamanio y adicionales sin cambios.';
