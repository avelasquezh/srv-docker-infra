-- ================================================================
-- 010_desacoplar_vista_catalogo_agente_de_legacy.sql
--
-- Hallazgo (al intentar correr 009): existe una vista `vista_catalogo_agente`
-- (no rastreada en ninguna migración de git, creada directo en producción)
-- que depende de `catalogo_precios` para el campo `precios_por_tamanio`.
-- Confirmado por el dueño: n8n la consulta directo contra Postgres, sin pasar
-- por el API — es el catálogo pre-armado para el nodo de IA (pendiente #4 de
-- la sección 7ter). Como nadie sabía que existía, no se actualizó cuando se
-- hizo el corte de Fase 5 (migración 008 + admin de precios, entrada #43) —
-- seguía leyendo del esquema legacy mientras todo lo demás ya no.
--
-- Esta migración actualiza SOLO el campo `precios_por_tamanio` para que lea
-- de `variantes`/`atributos_resueltos` (mismo criterio de "variante base,
-- solo Tamaño, sin extras" que ya se usó en 008) — el resto de la vista
-- (`adicionales`, `categorias`, `disenos_disponibles`) no se toca, siguen
-- leyendo de tablas que siguen vivas (`atributos`/`atributo_opciones`/
-- `catalogo_atributos`, fuera de Fase 6 por decisión de producto).
--
-- Validado antes de aplicar: comparación 1:1 entre `catalogo_precios` y
-- `variantes` para el campo `precios_por_tamanio` sobre TODOS los productos
-- activos del catálogo real en producción — 0 discrepancias.
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
    ( SELECT jsonb_agg(jsonb_build_object('nombre', a.nombre, 'tipo', a.tipo, 'sobreprecio', a.sobreprecio, 'opciones',
        ( SELECT jsonb_agg(jsonb_build_object('nombre', ao.nombre, 'valor', ao.valor))
          FROM atributo_opciones ao
          WHERE ao.atributo_id = a.id)))
      FROM catalogo_atributos ca
      JOIN atributos a ON a.id = ca.atributo_id
      WHERE ca.catalogo_id = cp.id AND a.activo
    ) AS adicionales,
    ( SELECT jsonb_agg(c.nombre)
      FROM catalogo_productos_categorias cpc
      JOIN categorias c ON c.id = cpc.categoria_id
      WHERE cpc.catalogo_id = cp.id
    ) AS categorias,
    ( SELECT jsonb_agg(d.nombre)
      FROM disenos_catalogo_productos dcp
      JOIN disenos d ON d.id = dcp.diseno_id
      WHERE dcp.catalogo_id = cp.id AND d.estado = 'Disponible'
    ) AS disenos_disponibles
FROM catalogo_productos cp
WHERE activo = true;

COMMENT ON VIEW vista_catalogo_agente IS
  'Catálogo pre-armado para el nodo de IA de n8n (consultado directo contra '
  'Postgres, no vía API). Desde 010: precios_por_tamanio lee de variantes/'
  'atributos_resueltos, ya NO de catalogo_precios (legacy) — validado sin '
  'discrepancias contra todos los productos activos antes de aplicar. '
  'adicionales/categorias/disenos_disponibles sin cambios, siguen vivos.';
