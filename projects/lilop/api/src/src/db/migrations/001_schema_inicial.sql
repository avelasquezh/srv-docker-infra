-- ============================================================
--  LILOP  –  Migración 001  –  Schema inicial
-- ============================================================

-- ------------------------------------------------------------
-- TIPOS ENUMERADOS
-- ------------------------------------------------------------
CREATE TYPE rol_usuario      AS ENUM ('admin', 'vendedor', 'domiciliario');
CREATE TYPE origen_venta     AS ENUM ('Cliente', 'Facebook', 'WhatsApp', 'Referido');
CREATE TYPE medio_pago       AS ENUM ('Daviplata', 'Nequi', 'Transferencia', 'Efectivo', 'MP');
CREATE TYPE estado_pedido    AS ENUM ('pendiente', 'confirmado', 'listo', 'enviado', 'entregado', 'cancelado', 'devuelto');
CREATE TYPE estado_producto  AS ENUM ('Por Comprar', 'Comprado', 'Listo', 'Entregado');
CREATE TYPE estado_compra    AS ENUM ('Pendiente', 'Comprado', 'Recibido');
CREATE TYPE estado_entrega   AS ENUM ('Pendiente', 'En camino', 'Entregado');
CREATE TYPE estado_comision  AS ENUM ('Pendiente', 'Pagada');
CREATE TYPE concepto_compra  AS ENUM ('Tela', 'Confección', 'Bordado', 'Empaque', 'Otro');
CREATE TYPE tamanio_producto AS ENUM ('Sencillo', 'Doble', 'Queen', 'King');

-- ------------------------------------------------------------
-- SECUENCIAS PARA CÓDIGOS LEGIBLES
-- ------------------------------------------------------------
CREATE SEQUENCE seq_usuarios   START 1;
CREATE SEQUENCE seq_clientes   START 1;
CREATE SEQUENCE seq_pedidos    START 1;
CREATE SEQUENCE seq_productos  START 1;
CREATE SEQUENCE seq_compras    START 1;
CREATE SEQUENCE seq_entregas   START 1;
CREATE SEQUENCE seq_comisiones START 1;

-- ------------------------------------------------------------
-- USUARIOS
-- ------------------------------------------------------------
CREATE TABLE usuarios (
    id           TEXT         PRIMARY KEY
                              DEFAULT 'US' || LPAD(nextval('seq_usuarios')::TEXT, 4, '0'),
    nombre       TEXT         NOT NULL,
    celular      TEXT,
    email        TEXT         UNIQUE,
    password     TEXT,
    rol          rol_usuario  NOT NULL DEFAULT 'vendedor',
    comision_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00
                              CHECK (comision_pct >= 0 AND comision_pct <= 100),
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------
CREATE TABLE clientes (
    id           TEXT         PRIMARY KEY
                              DEFAULT 'CL' || LPAD(nextval('seq_clientes')::TEXT, 4, '0'),
    nombre       TEXT         NOT NULL,
    celular      TEXT,
    ciudad       TEXT,
    localidad    TEXT,
    barrio       TEXT,
    direccion    TEXT,
    origen_venta origen_venta,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- PEDIDOS
-- ------------------------------------------------------------
CREATE TABLE pedidos (
    id              TEXT          PRIMARY KEY
                                  DEFAULT 'PD' || LPAD(nextval('seq_pedidos')::TEXT, 4, '0'),
    fecha_venta     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    fecha_entrega   DATE,
    valor_venta     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_venta >= 0),
    costo           NUMERIC(12,2) NOT NULL DEFAULT 0,
    comision        NUMERIC(12,2) NOT NULL DEFAULT 0,
    valor_domicilio NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_domicilio >= 0),
    ganancias       NUMERIC(12,2) GENERATED ALWAYS AS
                        (valor_venta - costo - valor_domicilio - comision) STORED,
    cliente_id      TEXT          NOT NULL REFERENCES clientes(id) ON UPDATE CASCADE,
    vendedor_id     TEXT          NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE,
    domiciliario    TEXT,
    medio_pago      medio_pago,
    estado          estado_pedido NOT NULL DEFAULT 'pendiente',
    origen          origen_venta,
    notas           TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- PRODUCTOS  (ítems del pedido)
-- ------------------------------------------------------------
CREATE TABLE productos (
    id          TEXT             PRIMARY KEY
                                 DEFAULT 'PR' || LPAD(nextval('seq_productos')::TEXT, 4, '0'),
    pedido_id   TEXT             NOT NULL REFERENCES pedidos(id) ON UPDATE CASCADE ON DELETE CASCADE,
    nombre      TEXT             NOT NULL,
    tamanio     tamanio_producto,
    diseno      TEXT,
    costo_total NUMERIC(12,2)    NOT NULL DEFAULT 0,
    estado      estado_producto  NOT NULL DEFAULT 'Por Comprar',
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- COMPRAS  (costos de fabricación por producto)
-- ------------------------------------------------------------
CREATE TABLE compras (
    id             TEXT           PRIMARY KEY
                                  DEFAULT 'CP' || LPAD(nextval('seq_compras')::TEXT, 4, '0'),
    producto_id    TEXT           NOT NULL REFERENCES productos(id) ON UPDATE CASCADE ON DELETE CASCADE,
    concepto       concepto_compra,
    diseno         TEXT,
    proveedor      TEXT,
    cantidad       NUMERIC(10,2)  NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    valor_unitario NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
    valor_total    NUMERIC(12,2)  GENERATED ALWAYS AS (cantidad * valor_unitario) STORED,
    fecha_compra   DATE,
    estado         estado_compra  NOT NULL DEFAULT 'Pendiente',
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ENTREGAS
-- ------------------------------------------------------------
CREATE TABLE entregas (
    id              TEXT           PRIMARY KEY
                                   DEFAULT 'EN' || LPAD(nextval('seq_entregas')::TEXT, 4, '0'),
    pedido_id       TEXT           NOT NULL REFERENCES pedidos(id) ON UPDATE CASCADE ON DELETE CASCADE,
    fecha_entrega   DATE,
    valor_domicilio NUMERIC(12,2)  NOT NULL DEFAULT 0,
    domiciliario    TEXT,
    estado          estado_entrega NOT NULL DEFAULT 'Pendiente',
    notas           TEXT,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- COMISIONES
-- ------------------------------------------------------------
CREATE TABLE comisiones (
    id             TEXT            PRIMARY KEY
                                   DEFAULT 'CM' || LPAD(nextval('seq_comisiones')::TEXT, 4, '0'),
    pedido_id      TEXT            NOT NULL REFERENCES pedidos(id) ON UPDATE CASCADE ON DELETE CASCADE,
    vendedor_id    TEXT            NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE,
    valor_comision NUMERIC(12,2)   NOT NULL DEFAULT 0,
    estado         estado_comision NOT NULL DEFAULT 'Pendiente',
    created_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_comision_pedido UNIQUE (pedido_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_pedidos_cliente   ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_vendedor  ON pedidos(vendedor_id);
CREATE INDEX idx_pedidos_estado    ON pedidos(estado);
CREATE INDEX idx_pedidos_fecha     ON pedidos(fecha_venta DESC);
CREATE INDEX idx_productos_pedido  ON productos(pedido_id);
CREATE INDEX idx_compras_producto  ON compras(producto_id);
CREATE INDEX idx_entregas_pedido   ON entregas(pedido_id);
CREATE INDEX idx_comisiones_pedido ON comisiones(pedido_id);
CREATE INDEX idx_comisiones_vend   ON comisiones(vendedor_id);

-- ============================================================
-- TRIGGERS — updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_updated_at   BEFORE UPDATE ON usuarios   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_clientes_updated_at   BEFORE UPDATE ON clientes   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_pedidos_updated_at    BEFORE UPDATE ON pedidos    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_productos_updated_at  BEFORE UPDATE ON productos  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_compras_updated_at    BEFORE UPDATE ON compras    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_entregas_updated_at   BEFORE UPDATE ON entregas   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_comisiones_updated_at BEFORE UPDATE ON comisiones FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- TRIGGER — recalcular costo_total del PRODUCTO cuando cambian COMPRAS
-- ============================================================
CREATE OR REPLACE FUNCTION fn_recalc_producto_costo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_producto_id TEXT;
BEGIN
    v_producto_id := COALESCE(NEW.producto_id, OLD.producto_id);
    UPDATE productos
    SET    costo_total = COALESCE(
               (SELECT SUM(valor_total) FROM compras WHERE producto_id = v_producto_id), 0
           )
    WHERE  id = v_producto_id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_compras_recalc_producto
AFTER INSERT OR UPDATE OR DELETE ON compras
FOR EACH ROW EXECUTE FUNCTION fn_recalc_producto_costo();

-- ============================================================
-- TRIGGER — recalcular costo del PEDIDO cuando cambia costo_total del PRODUCTO
-- ============================================================
CREATE OR REPLACE FUNCTION fn_recalc_pedido_costo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_pedido_id TEXT;
BEGIN
    v_pedido_id := COALESCE(NEW.pedido_id, OLD.pedido_id);
    UPDATE pedidos
    SET    costo = COALESCE(
               (SELECT SUM(costo_total) FROM productos WHERE pedido_id = v_pedido_id), 0
           )
    WHERE  id = v_pedido_id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_productos_recalc_pedido
AFTER INSERT OR UPDATE OF costo_total OR DELETE ON productos
FOR EACH ROW EXECUTE FUNCTION fn_recalc_pedido_costo();

-- ============================================================
-- TRIGGER — recalcular comision del PEDIDO y sincronizar COMISIONES
-- ============================================================
CREATE OR REPLACE FUNCTION fn_recalc_pedido_comision()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_pct   NUMERIC;
    v_valor NUMERIC;
BEGIN
    SELECT comision_pct INTO v_pct FROM usuarios WHERE id = NEW.vendedor_id;
    v_valor := ROUND(NEW.valor_venta * COALESCE(v_pct, 0) / 100.0, 2);
    NEW.comision := v_valor;

    INSERT INTO comisiones (pedido_id, vendedor_id, valor_comision)
    VALUES (NEW.id, NEW.vendedor_id, v_valor)
    ON CONFLICT (pedido_id)
    DO UPDATE SET
        vendedor_id    = EXCLUDED.vendedor_id,
        valor_comision = EXCLUDED.valor_comision,
        updated_at     = NOW();

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pedidos_recalc_comision
BEFORE INSERT OR UPDATE OF valor_venta, vendedor_id ON pedidos
FOR EACH ROW EXECUTE FUNCTION fn_recalc_pedido_comision();

-- ============================================================
-- TRIGGER — copiar origen_venta del cliente al crear pedido
-- ============================================================
CREATE OR REPLACE FUNCTION fn_pedido_set_origen()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.origen IS NULL THEN
        SELECT origen_venta INTO NEW.origen FROM clientes WHERE id = NEW.cliente_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pedidos_set_origen
BEFORE INSERT ON pedidos
FOR EACH ROW EXECUTE FUNCTION fn_pedido_set_origen();

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================
CREATE VIEW v_pedidos_resumen AS
SELECT
    p.id,
    p.fecha_venta,
    p.fecha_entrega,
    c.nombre          AS cliente,
    c.celular         AS cliente_cel,
    u.nombre          AS vendedor,
    p.valor_venta,
    p.costo,
    p.comision,
    p.valor_domicilio,
    p.ganancias,
    p.medio_pago,
    p.estado,
    p.origen
FROM pedidos p
JOIN clientes c ON c.id = p.cliente_id
JOIN usuarios u ON u.id = p.vendedor_id;

-- ============================================================
-- USUARIO ADMIN INICIAL
-- ============================================================
INSERT INTO usuarios (nombre, email, password, rol, comision_pct)
VALUES (
    'Administrador',
    'admin@lilop.store',
    '$2b$10$iqk5Cs6lWkO5yQgyW.6v7OeREcBLkAVGtVDdSq3lQxh0yv2gze73u',
    'admin',
    0
);
