-- ================================================================
-- 007_documentar_triggers_domicilio_costos_otros.sql
--
-- Mismo caso que 004 (comisión): estos dos triggers YA EXISTÍAN en
-- producción, por fuera de git (autor y fecha original desconocidos).
-- Se descubrieron al investigar el esquema real de `entregas` y
-- `costos_pedido` antes de migrar `costos_pedido.js` a POO/SOLID
-- (mismo criterio de la entrada #29 de la sección 8: nunca asumir que
-- el repo refleja el 100% de lo que corre en prod).
--
-- Este archivo no crea nada nuevo: usa CREATE OR REPLACE / DROP+CREATE
-- (idempotente) para dejar en git, con el texto exacto confirmado con
-- `\sf` en el servidor real, lo que ya corre en producción.
-- ================================================================

-- trg_entregas_recalc_domicilio: recalcula pedidos.valor_domicilio,
-- pero SOLO cuenta entregas con estado_pago = 'Pagado' — mismo
-- criterio de negocio que la comisión (004): solo lo ya pagado cuenta
-- para el cálculo real de costos/ganancias.
CREATE OR REPLACE FUNCTION fn_recalc_domicilio_pedido()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_pedido_id TEXT;
BEGIN
  v_pedido_id := COALESCE(NEW.pedido_id, OLD.pedido_id);
  UPDATE pedidos SET valor_domicilio = (
    SELECT COALESCE(SUM(valor_domicilio), 0)
    FROM entregas
    WHERE pedido_id = v_pedido_id AND estado_pago = 'Pagado'
  ) WHERE id = v_pedido_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_entregas_recalc_domicilio ON entregas;
CREATE TRIGGER trg_entregas_recalc_domicilio
AFTER INSERT OR UPDATE OF valor_domicilio, estado_pago OR DELETE ON entregas
FOR EACH ROW EXECUTE FUNCTION fn_recalc_domicilio_pedido();

-- trg_costos_otros_recalc_pedido: recalcula pedidos.costos_otros
-- sumando TODOS los costos_pedido del pedido (esta tabla no tiene
-- estado/estado_pago — no aplica el filtro de "solo pagado").
CREATE OR REPLACE FUNCTION fn_recalc_costos_otros_pedido()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_pedido_id TEXT;
BEGIN
  v_pedido_id := COALESCE(NEW.pedido_id, OLD.pedido_id);
  UPDATE pedidos SET costos_otros = (
    SELECT COALESCE(SUM(valor), 0) FROM costos_pedido WHERE pedido_id = v_pedido_id
  ) WHERE id = v_pedido_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_costos_otros_recalc_pedido ON costos_pedido;
CREATE TRIGGER trg_costos_otros_recalc_pedido
AFTER INSERT OR UPDATE OR DELETE ON costos_pedido
FOR EACH ROW EXECUTE FUNCTION fn_recalc_costos_otros_pedido();

COMMENT ON FUNCTION fn_recalc_domicilio_pedido() IS
  'Recalcula pedidos.valor_domicilio como la suma de entregas en estado_pago '
  'Pagado para ese pedido. Ver controllers/costos_pedido.js (agregarDomicilio/'
  'eliminarDomicilio) — no duplicar este cálculo ahí, ver entrada #29 de la '
  'sección 8 del MD (mismo bug ya corregido una vez para comisiones).';

COMMENT ON FUNCTION fn_recalc_costos_otros_pedido() IS
  'Recalcula pedidos.costos_otros como la suma de costos_pedido ("otros" '
  'costos) para ese pedido. Sin filtro de estado (esta tabla no tiene esa '
  'columna) — a diferencia de comisión/domicilio, todo lo agregado cuenta.';
