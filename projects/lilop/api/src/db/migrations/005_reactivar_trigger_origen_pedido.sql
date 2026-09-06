-- ================================================================
-- 005_reactivar_trigger_origen_pedido.sql
--
-- Hallazgo (sesión de investigación del dominio `pedidos`, ver sección 0
-- del MD de contexto): `trg_pedidos_set_origen` estaba declarado en
-- 001_schema_inicial.sql, pero `\d pedidos` en producción confirma que
-- HOY NO EXISTE — solo están `trg_pedidos_ganancias` y
-- `trg_pedidos_updated_at`. La función `fn_pedido_set_origen()` sí existe
-- en prod (confirmado con `\sf`, misma definición exacta que en 001), solo
-- falta el trigger que la dispara. `controllers/pedidos.js` tampoco setea
-- `origen` en `crear()`/`actualizar()` — sin este trigger, `origen` queda
-- `NULL` en todo pedido nuevo.
--
-- Decisión del dueño: reactivar (no es una feature abandonada a propósito).
--
-- Este archivo es idempotente (CREATE OR REPLACE + DROP TRIGGER IF EXISTS)
-- para que corra igual en un entorno nuevo (donde 001 ya declaró la función
-- pero el trigger real de prod nunca quedó registrado en `pgmigrations`,
-- ver gotcha de la sección 4.2) y en producción (donde solo falta crear el
-- trigger).
-- ================================================================

CREATE OR REPLACE FUNCTION fn_pedido_set_origen()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.origen IS NULL THEN
        SELECT origen_venta INTO NEW.origen FROM clientes WHERE id = NEW.cliente_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_set_origen ON pedidos;
CREATE TRIGGER trg_pedidos_set_origen
BEFORE INSERT ON pedidos
FOR EACH ROW EXECUTE FUNCTION fn_pedido_set_origen();

COMMENT ON FUNCTION fn_pedido_set_origen() IS
  'Si el pedido se crea sin origen explícito, lo copia de clientes.origen_venta. '
  'Reactivado en 005 tras confirmar que el trigger original de 001 no llegó a '
  'existir en producción (la función sí, el trigger no) y que no era una baja '
  'intencional.';
