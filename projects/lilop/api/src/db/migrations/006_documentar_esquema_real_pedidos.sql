-- ================================================================
-- 006_documentar_esquema_real_pedidos.sql
--
-- As-built del dominio `pedidos`: 001_schema_inicial.sql quedó desactualizado
-- respecto a lo que realmente corre en producción (deriva aplicada fuera de
-- git, mismo patrón que 004). Este archivo es idempotente a propósito: en
-- producción casi todo esto ya existe y no debería cambiar nada (son no-ops
-- guardados); en un entorno nuevo levantado desde cero con las migraciones
-- de git, este archivo corrige el esquema para que quede igual a producción.
--
-- Confirmado con `\d`/`\sf`/`\dT+`/`pg_get_viewdef` reales contra el
-- servidor de producción antes de escribir esto (ver sección 0 del MD de
-- contexto para el detalle completo de cada hallazgo).
--
-- IMPORTANTE — esto NO resuelve el hallazgo bloqueante de Fase 6: el
-- trigger `fn_recalc_pedido_valor_venta` (punto 7 de este archivo) sigue
-- dependiendo de `catalogo_productos`/`catalogo_precios` (tablas legacy).
-- Este archivo solo dEja constancia en git de que ese trigger existe y
-- cómo funciona hoy — no lo desacopla del esquema viejo. Ese desacople es
-- trabajo de la Fase 5 (corte), no de esta migración.
-- ================================================================

-- 1. Tabla `medios_pago` — usada por 3 controllers (pedidos.js x2,
--    pedidos_publicos.js) pero nunca declarada en ninguna migración.
--    Un entorno nuevo con las migraciones actuales rompe en el primer
--    POST /pedidos con medio_pago sin esta tabla.
CREATE TABLE IF NOT EXISTS medios_pago (
    id     SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE
);

-- 2. Enum `estado_pago_pedido` — nuevo, no existía en 001. Valores reales
--    confirmados con \dT+: pendiente, pagado, rechazado.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_pago_pedido') THEN
    CREATE TYPE estado_pago_pedido AS ENUM ('pendiente', 'pagado', 'rechazado');
  END IF;
END $$;

-- 3. Enum `estado_pedido` — 001 lo declaró con una lista de valores que NO
--    corresponde a la realidad (pendiente/confirmado/listo/enviado/
--    entregado/cancelado/devuelto). El real, confirmado con \dT+, es:
--    por_confirmar/en_alistamiento/por_entregar/entregado/cancelado.
--    Este bloque solo actúa si detecta el enum viejo (entorno recién creado
--    desde 001) — en prod ya tiene los valores correctos y es un no-op.
--    Seguridad: si por algún motivo hay filas en `pedidos` y el enum sigue
--    con los valores viejos, se aborta con RAISE EXCEPTION en vez de
--    intentar mapear datos reales a ciegas.
DO $$
DECLARE
  v_filas_pedidos INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'estado_pedido' AND e.enumlabel = 'por_confirmar'
  ) THEN
    SELECT count(*) INTO v_filas_pedidos FROM pedidos;
    IF v_filas_pedidos > 0 THEN
      RAISE EXCEPTION
        'estado_pedido tiene los valores viejos de 001 pero pedidos ya tiene % fila(s) - revisar manualmente antes de recrear el enum, no se puede mapear a ciegas',
        v_filas_pedidos;
    END IF;

    ALTER TABLE pedidos ALTER COLUMN estado DROP DEFAULT;
    CREATE TYPE estado_pedido_v2 AS ENUM
      ('por_confirmar', 'en_alistamiento', 'por_entregar', 'entregado', 'cancelado');
    ALTER TABLE pedidos ALTER COLUMN estado TYPE estado_pedido_v2
      USING estado::text::estado_pedido_v2;
    DROP TYPE estado_pedido;
    ALTER TYPE estado_pedido_v2 RENAME TO estado_pedido;
    ALTER TABLE pedidos ALTER COLUMN estado SET DEFAULT 'por_confirmar'::estado_pedido;
  END IF;
END $$;

-- 4. Columna `medio_pago` (enum embebido, 001) -> `medio_pago_id` (FK a
--    medios_pago). Ya migrado en prod fuera de git; aquí se documenta.
ALTER TABLE pedidos DROP COLUMN IF EXISTS medio_pago;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS medio_pago_id INTEGER REFERENCES medios_pago(id);
-- Nota: el tipo enum `medio_pago` (CREATE TYPE de 001) queda huérfano, sin
-- ninguna columna que lo use. Se deja intacto a propósito (no bloquea nada,
-- no vale el riesgo de un DROP TYPE innecesario en esta migración).

-- 5. Columnas confirmadas en prod que no estaban en 001.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS costos_otros NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estado_pago estado_pago_pedido NOT NULL DEFAULT 'pendiente';

-- 6. `ganancias`: en 001 es GENERATED ALWAYS AS (...) STORED; en prod es una
--    columna normal poblada por trigger BEFORE INSERT/UPDATE, porque la
--    fórmula real es condicional sobre NEW.estado ('entregado' vs. el resto)
--    y depende de `costos_otros` (agregada después, no existía cuando se
--    escribió la expresión GENERATED original).
ALTER TABLE pedidos ALTER COLUMN ganancias DROP EXPRESSION IF EXISTS;

CREATE OR REPLACE FUNCTION fn_recalc_ganancias()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'entregado' THEN
    NEW.ganancias := NEW.valor_venta - NEW.costo - NEW.valor_domicilio - NEW.comision - NEW.costos_otros;
  ELSE
    NEW.ganancias := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_ganancias ON pedidos;
CREATE TRIGGER trg_pedidos_ganancias
BEFORE INSERT OR UPDATE ON pedidos
FOR EACH ROW EXECUTE FUNCTION fn_recalc_ganancias();

-- 7. Trigger que recalcula `pedidos.valor_venta` cuando cambian los
--    productos de un pedido. No estaba en 001, se agregó fuera de git.
--    *** BLOQUEANTE DE FASE 6 (ver sección 0 del MD) ***: depende de
--    catalogo_productos/catalogo_precios (tablas legacy, match por texto
--    de `nombre` + `tamanio`). No se puede dropear esas tablas sin migrar
--    primero este trigger al esquema nuevo (variables/variantes/
--    atributos_resueltos). Esta migración documenta el comportamiento
--    real, no lo cambia.
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
      ELSE cp.precio * p.cantidad
    END
  ), 0) INTO v_total
  FROM productos p
  LEFT JOIN catalogo_productos cat ON cat.nombre = p.nombre
  LEFT JOIN catalogo_precios cp ON cp.catalogo_id = cat.id AND cp.tamanio = p.tamanio
  WHERE p.pedido_id = v_pedido_id;

  UPDATE pedidos SET valor_venta = v_total WHERE id = v_pedido_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_productos_recalc_valor_venta ON productos;
CREATE TRIGGER trg_productos_recalc_valor_venta
AFTER INSERT OR DELETE OR UPDATE OF nombre, tamanio, valor_venta_override ON productos
FOR EACH ROW EXECUTE FUNCTION fn_recalc_pedido_valor_venta();

-- 8. Vista `v_pedidos_resumen`: la de 001 referenciaba `p.medio_pago`
--    (columna que ya no existe) y no traía cliente_id/vendedor_id/notas/
--    comision_pendiente. Se reemplaza por la definición real confirmada en
--    producción vía pg_get_viewdef(). DROP+CREATE (no REPLACE) porque el
--    orden y la cantidad de columnas cambia — CREATE OR REPLACE VIEW solo
--    permite agregar columnas al final, no reordenar ni insertar en medio.
DROP VIEW IF EXISTS v_pedidos_resumen;
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

COMMENT ON TABLE medios_pago IS
  'Catálogo de medios de pago. Reemplazó al enum medio_pago (ver 001) fuera '
  'de git; documentado aquí en 006 para que un entorno nuevo no rompa.';
