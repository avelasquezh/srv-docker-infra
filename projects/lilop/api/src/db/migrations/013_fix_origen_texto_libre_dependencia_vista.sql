-- ================================================================
-- 013_fix_origen_texto_libre_dependencia_vista.sql
--
-- La migración 012 (pedidos.origen: enum -> TEXT) falló en producción:
--   error: cannot alter type of a column used by a view or rule
--   detail: rule _RETURN on view v_pedidos_resumen depends on column "origen"
--
-- node-pg-migrate hizo rollback de la transacción de 012 (no quedó
-- registrada en pgmigrations), así que en producción pedidos.origen
-- SIGUE siendo el enum rígido origen_venta — el bug real (500 en
-- POST /api/pedidos para cualquier cliente con origen_venta que no
-- calce con los 5 valores del enum) sigue activo.
--
-- Fix: soltar la vista, hacer el ALTER, recrearla idéntica. Definición
-- de la vista verificada contra producción real con
-- `SELECT pg_get_viewdef('v_pedidos_resumen', true)` antes de escribir
-- esta migración — coincide exactamente con la de
-- 006_documentar_esquema_real_pedidos.sql, sin cambios no documentados.
-- ================================================================

DROP VIEW IF EXISTS v_pedidos_resumen;

ALTER TABLE pedidos ALTER COLUMN origen TYPE TEXT USING origen::TEXT;

DROP TYPE IF EXISTS origen_venta;

COMMENT ON COLUMN pedidos.origen IS
  'Texto libre (antes enum origen_venta, ver migraciones 012/013). Se '
  'copia automáticamente de clientes.origen_venta si no se envía '
  'explícito (trigger fn_pedido_set_origen) — ambas columnas son texto '
  'libre real, no una categoría fija.';

CREATE VIEW v_pedidos_resumen AS
SELECT p.id,
    p.cliente_id,
    p.fecha_venta,
    p.fecha_entrega,
    c.nombre AS cliente,
    c.celular AS cliente_cel,
    u.nombre AS vendedor,
    u.id AS vendedor_id,
    p.valor_venta,
    p.costo,
    p.comision,
    (SELECT COALESCE(sum(comisiones.valor_comision), 0::numeric)
       FROM comisiones
      WHERE comisiones.pedido_id = p.id AND comisiones.estado = 'Pendiente'::estado_comision) AS comision_pendiente,
    p.valor_domicilio,
    p.ganancias,
    mp.nombre AS medio_pago,
    p.estado,
    p.notas,
    p.origen
   FROM pedidos p
     JOIN clientes c ON c.id = p.cliente_id
     JOIN usuarios u ON u.id = p.vendedor_id
     LEFT JOIN medios_pago mp ON mp.id = p.medio_pago_id;
