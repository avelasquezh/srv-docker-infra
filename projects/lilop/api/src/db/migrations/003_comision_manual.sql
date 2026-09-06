-- ================================================================
-- 003_comision_manual.sql
--
-- Decisión de negocio (confirmada por el dueño, 2026-09): la comisión
-- deja de calcularse automáticamente por % (comision_pct en usuarios +
-- trigger fn_recalc_pedido_comision sobre pedidos). Pasa a ser 100%
-- manual desde el front: uno o más registros libres por pedido, cada
-- uno con un nombre de vendedor en texto (no necesariamente un
-- usuario del sistema) y un valor fijo — mismo patrón ya usado por
-- costos_pedido para "otros" costos y para domicilios (entregas).
--
-- ADITIVO donde es posible: no se borra vendedor_id ni el histórico
-- ya generado por el trigger. Los dos únicos cambios no reversibles
-- son el DROP del trigger (decisión de negocio explícita, no un
-- accidente) y el DROP de la constraint UNIQUE(pedido_id) (deja de
-- tener sentido: ahora puede haber varias comisiones manuales por
-- pedido, igual que ya pasa con costos_pedido/entregas).
-- ================================================================

-- Comisiones manuales no siempre corresponden a un usuario real del
-- sistema (texto libre tecleado en el front) — se agrega la columna
-- y se afloja vendedor_id, que ya no puede ser NOT NULL.
ALTER TABLE comisiones ADD COLUMN IF NOT EXISTS nombre_vendedor TEXT;
ALTER TABLE comisiones ALTER COLUMN vendedor_id DROP NOT NULL;

-- Antes solo podía existir 1 fila de comisión por pedido (una por
-- vendedor, vía trigger). Con comisiones manuales libres, un pedido
-- puede tener varias — mismo criterio que costos_pedido/entregas.
ALTER TABLE comisiones DROP CONSTRAINT IF EXISTS uq_comision_pedido;

-- Se desactiva el cálculo automático. La función fn_recalc_pedido_comision
-- se deja definida (no se borra) por si se necesita consultar su lógica
-- histórica — pero ya no se dispara con ningún trigger.
DROP TRIGGER IF EXISTS trg_pedidos_recalc_comision ON pedidos;

COMMENT ON FUNCTION fn_recalc_pedido_comision() IS
  'DEPRECADA desde 003_comision_manual.sql — la comisión ahora es manual '
  '(ver controllers/costos_pedido.js). Se conserva la función sin trigger '
  'asociado únicamente como referencia histórica.';
