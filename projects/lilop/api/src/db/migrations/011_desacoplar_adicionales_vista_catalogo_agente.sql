-- ================================================================
-- 011_desacoplar_adicionales_vista_catalogo_agente.sql
--
-- Continúa el desacople de vista_catalogo_agente (ver 009): esta vez
-- el campo `adicionales`, que leía de atributos/atributo_opciones/
-- catalogo_atributos (legacy), ahora lee de variables/variable_valores/
-- producto_variables (esquema nuevo) — ver plan completo en la sección
-- 7quinquies del MD de contexto.
--
-- Filtro `v.nombre <> 'Tamaño'` reproduce el comportamiento original:
-- `adicionales` nunca incluyó el tamaño (vivía en una tabla aparte,
-- catalogo_precios), solo atributos booleanos/selección tipo Plumón —
-- en el esquema nuevo, Tamaño y estos atributos conviven en la misma
-- tabla `variables`, así que hay que excluirlo explícitamente.
--
-- `opciones` ahora sale de `variable_valores` (antes `atributo_opciones`).
-- Nota de fidelidad: `atributo_opciones` tenía `nombre` y `valor` como
-- columnas separadas; `variable_valores` solo tiene `valor` — se usa el
-- mismo texto para ambos campos del JSON de salida. Sin impacto real
-- hoy (0 filas en atributo_opciones en producción, confirmado antes de
-- escribir esto), documentado por si en el futuro se agregan atributos
-- tipo lista con opciones reales.
--
-- Validado antes de aplicar: comparación 1:1 de `adicionales` (nombre,
-- tipo, sobreprecio) entre el query viejo y el nuevo, sobre TODOS los
-- productos activos de producción — 0 discrepancias.
--
-- `precios_por_tamanio`/`categorias`/`disenos_disponibles` no se tocan,
-- ya estaban bien (009) o siguen vivos sin relación con este cambio.
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
  'Postgres, no vía API). Desde 011: precios_por_tamanio (desde 009) y '
  'adicionales (desde 011) leen de variantes/variables/producto_variables, '
  'ya NO de catalogo_precios/atributos/atributo_opciones/catalogo_atributos '
  '(legacy) — ambos validados sin discrepancias contra todos los productos '
  'activos antes de aplicar. categorias/disenos_disponibles sin cambios.';
