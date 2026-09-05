-- ================================================================
-- 002_variables_variantes.sql
--
-- Nuevo esquema de variables/variantes para catalogo_productos.
-- ADITIVO: no modifica ni elimina catalogo_precios, atributos,
-- atributo_opciones ni catalogo_atributos. Esas tablas siguen
-- siendo la fuente de verdad hasta que el corte (Fase 5 del plan
-- de migración) apunte los controllers al esquema nuevo.
-- ================================================================

CREATE SEQUENCE IF NOT EXISTS seq_variables START 1;
CREATE SEQUENCE IF NOT EXISTS seq_variable_valores START 1;
CREATE SEQUENCE IF NOT EXISTS seq_variantes START 1;

CREATE TYPE tipo_variable AS ENUM ('lista', 'booleano');

-- ------------------------------------------------------------
-- VARIABLES (catálogo global de dimensiones de variación:
-- Tamaño, Plumón, Piel de conejo, etc.)
-- ------------------------------------------------------------
CREATE TABLE variables (
    id          TEXT           PRIMARY KEY
                                DEFAULT 'VAR' || LPAD(nextval('seq_variables')::TEXT, 4, '0'),
    nombre      TEXT           NOT NULL UNIQUE,
    tipo        tipo_variable  NOT NULL,
    -- sobreprecio solo tiene sentido para tipo 'booleano' (se suma al
    -- precio base cuando el flag está activo en la variante). Para
    -- tipo 'lista' el precio de cada valor vive en variantes.precio.
    sobreprecio NUMERIC(12,2)  NOT NULL DEFAULT 0,
    activo      BOOLEAN        NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- VARIABLE_VALORES (catálogo global de valores posibles,
-- compartido entre productos; solo aplica a variables tipo 'lista')
-- ------------------------------------------------------------
CREATE TABLE variable_valores (
    id          TEXT    PRIMARY KEY
                        DEFAULT 'VVA' || LPAD(nextval('seq_variable_valores')::TEXT, 4, '0'),
    variable_id TEXT    NOT NULL REFERENCES variables(id) ON UPDATE CASCADE ON DELETE CASCADE,
    valor       TEXT    NOT NULL,
    orden       INTEGER NOT NULL DEFAULT 0,
    UNIQUE (variable_id, valor)
);

-- ------------------------------------------------------------
-- PRODUCTO_VARIABLES (qué variables usa cada producto del
-- catálogo, y para tipo 'lista' qué subconjunto de la lista
-- global le aplica a ESE producto puntual)
-- ------------------------------------------------------------
CREATE TABLE producto_variables (
    producto_id        TEXT   NOT NULL REFERENCES catalogo_productos(id) ON UPDATE CASCADE ON DELETE CASCADE,
    variable_id        TEXT   NOT NULL REFERENCES variables(id) ON UPDATE CASCADE ON DELETE CASCADE,
    -- IDs de variable_valores habilitados para este producto.
    -- NULL cuando variables.tipo = 'booleano' (no aplica subconjunto).
    valores_permitidos TEXT[] DEFAULT NULL,
    PRIMARY KEY (producto_id, variable_id)
);

-- ------------------------------------------------------------
-- VARIANTES (combinación concreta y vendible de un producto)
-- ------------------------------------------------------------
CREATE TABLE variantes (
    id                  TEXT          PRIMARY KEY
                                       DEFAULT 'VTE' || LPAD(nextval('seq_variantes')::TEXT, 4, '0'),
    producto_id         TEXT          NOT NULL REFERENCES catalogo_productos(id) ON UPDATE CASCADE ON DELETE CASCADE,
    -- {"<variable_id>": "<variable_valor_id>"} — solo variables tipo 'lista'
    valores             JSONB         NOT NULL DEFAULT '{}',
    -- {"<variable_id>": true|false} — solo variables tipo 'booleano'
    booleanos           JSONB         NOT NULL DEFAULT '{}',
    -- {"<nombre_variable>": "<valor_texto>" | true|false} — generado por trigger, NO editar a mano
    atributos_resueltos JSONB         NOT NULL DEFAULT '{}',
    sku                 TEXT          UNIQUE,
    precio              NUMERIC(12,2) NOT NULL,
    stock               INTEGER       NOT NULL DEFAULT 0,
    activo              BOOLEAN       NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variantes_producto ON variantes(producto_id);
CREATE INDEX idx_variantes_atributos_resueltos ON variantes USING GIN (atributos_resueltos);

-- ------------------------------------------------------------
-- TRIGGER: mantiene atributos_resueltos sincronizado siempre.
-- Ningún código de aplicación escribe atributos_resueltos a mano;
-- lo reconstruye la BD misma a partir de valores/booleanos.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_resolver_atributos_variante()
RETURNS TRIGGER AS $$
DECLARE
    resultado   JSONB := '{}'::JSONB;
    clave_var   TEXT;
    valor_id    TEXT;
    var_nombre  TEXT;
    val_texto   TEXT;
    clave_bool  TEXT;
    valor_bool  TEXT;
BEGIN
    -- Resolver dimensiones tipo 'lista': variable_id -> nombre real, variable_valor_id -> texto real
    FOR clave_var, valor_id IN SELECT * FROM jsonb_each_text(NEW.valores)
    LOOP
        SELECT v.nombre, vv.valor INTO var_nombre, val_texto
        FROM variables v
        JOIN variable_valores vv ON vv.variable_id = v.id
        WHERE v.id = clave_var AND vv.id = valor_id;

        IF var_nombre IS NOT NULL THEN
            resultado := resultado || jsonb_build_object(var_nombre, val_texto);
        END IF;
    END LOOP;

    -- Resolver dimensiones tipo 'booleano': variable_id -> nombre real
    FOR clave_bool, valor_bool IN SELECT * FROM jsonb_each_text(NEW.booleanos)
    LOOP
        SELECT v.nombre INTO var_nombre FROM variables v WHERE v.id = clave_bool;
        IF var_nombre IS NOT NULL THEN
            resultado := resultado || jsonb_build_object(var_nombre, valor_bool::BOOLEAN);
        END IF;
    END LOOP;

    NEW.atributos_resueltos := resultado;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resolver_atributos_variante
BEFORE INSERT OR UPDATE OF valores, booleanos ON variantes
FOR EACH ROW EXECUTE FUNCTION fn_resolver_atributos_variante();
