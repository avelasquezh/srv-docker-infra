-- ================================================================
-- 008_desacoplar_valor_venta_de_legacy.sql
--
-- BLOQUEANTE REAL DE FASE 6, resuelto (ver sección 0 del MD,
-- investigación previa de `pedidos`, punto #1). `fn_recalc_pedido_valor_venta()`
-- calculaba `pedidos.valor_venta` (y por lo tanto `ganancias`, vía
-- `trg_pedidos_ganancias`) uniendo contra `catalogo_productos`/
-- `catalogo_precios` (match por texto: nombre + tamaño). Esta
-- migración cambia el JOIN para que apunte al esquema nuevo
-- (`variantes`/`atributos_resueltos`) en su lugar — sin cambiar el
-- resultado para ningún pedido existente.
--
-- Validado exhaustivamente antes de escribir esto (ver entradas de
-- la sección 0/8 del MD para el detalle completo):
--   - Los 21 productos del catálogo tienen paridad completa entre
--     `catalogo_precios` y `variantes` (nunca falta ninguno).
--   - El precio de la variante "base" (solo Tamaño, sin Plumón/Piel
--     de conejo) coincide EXACTO con `catalogo_precios` para cada
--     tamaño de cada producto — confirmado con varios productos.
--   - Los 7 pedidos reales que tienen productos (de un total de 10
--     filas en `productos`) dan el MISMO `valor_venta` calculado con
--     el JOIN legacy que con el JOIN nuevo — comparación 1:1 completa,
--     sin excepciones.
--   - No hay variantes duplicadas por (producto_id, atributos_resueltos)
--     que pudieran romper el SUM con filas repetidas.
--
-- Por qué el match exacto por `atributos_resueltos = {"Tamaño": ...}`
-- (sin otras claves) preserva el comportamiento actual: la tabla
-- `productos` (línea de pedido) no tiene columna para Plumón/Piel de
-- conejo — hoy SOLO se puede vender el precio base por tamaño, nunca
-- con esos extras. El match debe seguir siendo así hasta que se
-- decida exponer esas variables en el flujo de venta (fuera de
-- alcance de este cambio).
-- ================================================================

CREATE OR REPLACE FUNCTION fn_recalc_pedido_valor_venta()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_pedido_id text;
  v_total     numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_pedido_id := OLD.pedido_id;
  ELSE
    v_pedido_id := NEW.pedido_id;
  END IF;
  SELECT COALESCE(SUM(
    CASE
      WHEN p.valor_venta_override IS NOT NULL THEN p.valor_venta_override
      ELSE v.precio * p.cantidad
    END
  ), 0) INTO v_total
  FROM productos p
  LEFT JOIN catalogo_productos cat ON cat.nombre = p.nombre
  LEFT JOIN variantes v ON v.producto_id = cat.id
    AND v.atributos_resueltos = jsonb_build_object('Tamaño', p.tamanio::text)
  WHERE p.pedido_id = v_pedido_id;
  UPDATE pedidos SET valor_venta = v_total WHERE id = v_pedido_id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_recalc_pedido_valor_venta() IS
  'Recalcula pedidos.valor_venta sumando el precio de la variante base '
  '(solo Tamaño, sin extras) de cada producto del pedido, o el override '
  'manual si existe. Desde 008: lee de variantes/atributos_resueltos '
  '(esquema nuevo), ya NO de catalogo_precios (legacy) — mismo '
  'resultado para todo pedido existente, validado antes de aplicar '
  '(ver sección 0 del MD). Sigue el mismo trigger '
  'trg_productos_recalc_valor_venta ya existente, solo cambió el '
  'cuerpo de la función.';
