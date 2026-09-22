-- ================================================================
-- 014_categorias_tipo.sql
--
-- La tabla `categorias` (no rastreada en ninguna migración anterior —
-- se creó directo en producción, verificado con \d antes de escribir
-- esto) mezcla en un solo listado plano 4 conceptos distintos:
--   - líneas de producto reales: Edredones, Sábanas, Combo,
--     Colcha Española, Almohadas, Accesorios, Protectores, Duvets,
--     Cortinas
--   - material: Microfibra, Venus
--   - target/segmento: Infantil, Niño, Niña
--   - diseño: Diseño, Unicolor
--
-- Esto ya causó un bug real: el menú de bienvenida de WhatsApp y el
-- prompt del bot mezclaban/hardcodeaban estos conceptos sin poder
-- distinguirlos, ofreciendo cosas sin inventario real (Duvets,
-- Cobijas) o mezclando "Niño"/"Unicolor" como si fueran productos.
--
-- Esta migración no cambia ningún dato existente de categorización de
-- productos (`catalogo_productos_categorias` no se toca) — solo
-- agrega una etiqueta para poder filtrar, ej. en el menú dinámico de
-- WhatsApp: "solo categorías con tipo = 'linea_producto'".
-- ================================================================

ALTER TABLE categorias ADD COLUMN tipo TEXT;

UPDATE categorias SET tipo = 'linea_producto'
  WHERE nombre IN ('Edredones', 'Sábanas', 'Combo', 'Colcha Española',
                    'Almohadas', 'Accesorios', 'Protectores', 'Duvets', 'Cortinas');

UPDATE categorias SET tipo = 'material'
  WHERE nombre IN ('Microfibra', 'Venus');

UPDATE categorias SET tipo = 'target'
  WHERE nombre IN ('Infantil', 'Niño', 'Niña');

UPDATE categorias SET tipo = 'diseno'
  WHERE nombre IN ('Diseño', 'Unicolor');

-- Cualquier categoría futura que no se clasifique explícitamente cae
-- por defecto en línea de producto (el caso más común al día de hoy),
-- para que nunca quede en NULL.
ALTER TABLE categorias ALTER COLUMN tipo SET DEFAULT 'linea_producto';

ALTER TABLE categorias ADD CONSTRAINT categorias_tipo_check
  CHECK (tipo IN ('linea_producto', 'material', 'target', 'diseno'));

ALTER TABLE categorias ALTER COLUMN tipo SET NOT NULL;

COMMENT ON COLUMN categorias.tipo IS
  'Distingue línea de producto real (linea_producto) de etiquetas de '
  'material, target o diseño que hoy viven en la misma tabla plana '
  '(ver migración 014). Usado para filtrar qué se ofrece como producto '
  'seleccionable, ej. en el menú de bienvenida del bot de WhatsApp.';
