-- ================================================================
-- 004_documentar_trigger_recalc_comision_pagada.sql
--
-- IMPORTANTE: este trigger y esta función YA EXISTÍAN en la base de
-- datos de producción antes de este archivo — se crearon por fuera
-- de git (autor y fecha original desconocidos, no hay migración
-- previa que los declare). Se descubrieron al correr 003 en prod:
-- los NOTICE de "already exists, skipping" revelaron que alguien ya
-- había hecho manualmente los mismos cambios estructurales de 003
-- (nombre_vendedor, DROP de la constraint/trigger viejos), y además
-- había agregado ESTE trigger nuevo, que 003 no conocía.
--
-- Este archivo no crea nada nuevo: usa CREATE OR REPLACE / DROP+CREATE
-- para dejar en git, de forma idempotente, exactamente lo que ya
-- corre en prod (confirmado con `\sf fn_recalc_comision_pedido` en el
-- servidor real) — así cualquier entorno nuevo levantado desde cero
-- con las migraciones queda con el mismo comportamiento.
--
-- Regla de negocio confirmada por el dueño: pedidos.comision (y por
-- lo tanto `ganancias`, columna GENERATED) solo debe contar las
-- comisiones ya pagadas (estado = 'Pagada'), no las pendientes.
-- ================================================================

CREATE OR REPLACE FUNCTION fn_recalc_comision_pedido()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_pedido_id TEXT;
BEGIN
  v_pedido_id := COALESCE(NEW.pedido_id, OLD.pedido_id);
  UPDATE pedidos SET comision = (
    SELECT COALESCE(SUM(valor_comision), 0)
    FROM comisiones
    WHERE pedido_id = v_pedido_id AND estado = 'Pagada'
  ) WHERE id = v_pedido_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comisiones_recalc_pedido ON comisiones;
CREATE TRIGGER trg_comisiones_recalc_pedido
AFTER INSERT OR UPDATE OR DELETE ON comisiones
FOR EACH ROW EXECUTE FUNCTION fn_recalc_comision_pedido();

COMMENT ON FUNCTION fn_recalc_comision_pedido() IS
  'Recalcula pedidos.comision como la suma de comisiones en estado '
  'Pagada para ese pedido. Reemplaza al viejo cálculo automático por % '
  '(ver 003_comision_manual.sql) — la comisión ahora es manual, pero '
  'solo impacta ganancias una vez pagada.';
