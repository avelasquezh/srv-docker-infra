-- ================================================================
-- 012_pedidos_origen_a_texto_libre.sql
--
-- INCIDENTE REAL: crear un pedido nuevo desde el admin fallaba con
--   invalid input value for enum origen_venta: "Fb Luisa Rodriguez"
--
-- Causa: `clientes.origen_venta` es TEXT libre en producción real desde
-- hace tiempo (valores reales: "Fb thiago", "Fb Luisa Rodriguez",
-- "WhatsApp Ventas", "Fb Ricardo Velasquez", "Cliente" — trackea quién
-- refirió al cliente, no una categoría fija). `pedidos.origen` seguía
-- siendo el enum rígido original de 001 (`Cliente`/`Facebook`/`WhatsApp`/
-- `Referido`/`Lilop.store`, esta última agregada después para
-- pedidos_publicos). El trigger `fn_pedido_set_origen()` copia
-- clientes.origen_venta -> pedidos.origen al crear un pedido — cualquier
-- cliente cuyo origen_venta no calce exacto con esos 5 valores rompe la
-- creación de CUALQUIER pedido nuevo para ese cliente.
--
-- No es un dato sucio a corregir — el texto libre en clientes.origen_venta
-- es la realidad real del negocio (nombres de referidos de Facebook).
-- La corrección correcta es que pedidos.origen deje de ser un enum
-- rígido, igual que ya es clientes.origen_venta.
--
-- Verificado antes de escribir esto que nada en el código (JS del admin,
-- API) depende de que pedidos.origen tenga un conjunto fijo de valores
-- (dashboard.js agrupa dinámicamente por el string que venga, sin
-- categorías hardcodeadas) — ver commit de este fix para el detalle.
-- ================================================================

ALTER TABLE pedidos ALTER COLUMN origen TYPE TEXT USING origen::TEXT;

-- El enum origen_venta ya no lo usa ninguna columna (clientes.origen_venta
-- ya era TEXT desde antes) — se elimina el tipo.
DROP TYPE IF EXISTS origen_venta;

COMMENT ON COLUMN pedidos.origen IS
  'Texto libre (antes enum origen_venta, ver migración 012). Se copia '
  'automáticamente de clientes.origen_venta si no se envía explícito '
  '(trigger fn_pedido_set_origen) — ambas columnas son texto libre real, '
  'no una categoría fija.';
