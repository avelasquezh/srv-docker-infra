--
-- PostgreSQL database dump
--

\restrict hekuYXkYHzS4WOvClChh2x6L6eNsxJfbMT4uhmcWyMlGKJj0KBTiy4tK2RoTyMz

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pedidos (
    id text DEFAULT ('PD'::text || lpad((nextval('public.seq_pedidos'::regclass))::text, 4, '0'::text)) NOT NULL,
    fecha_venta timestamp with time zone DEFAULT now() NOT NULL,
    fecha_entrega date,
    valor_venta numeric(12,2) DEFAULT 0 NOT NULL,
    costo numeric(12,2) DEFAULT 0 NOT NULL,
    comision numeric(12,2) DEFAULT 0 NOT NULL,
    valor_domicilio numeric(12,2) DEFAULT 0 NOT NULL,
    ganancias numeric(12,2),
    cliente_id text NOT NULL,
    vendedor_id text NOT NULL,
    domiciliario text,
    medio_pago public.medio_pago,
    estado public.estado_pedido DEFAULT 'por_confirmar'::public.estado_pedido NOT NULL,
    origen public.origen_venta,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    costos_otros numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT pedidos_valor_domicilio_check CHECK ((valor_domicilio >= (0)::numeric)),
    CONSTRAINT pedidos_valor_venta_check CHECK ((valor_venta >= (0)::numeric))
);


ALTER TABLE public.pedidos OWNER TO postgres;

--
-- Name: v_pedidos_resumen; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_pedidos_resumen AS
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
    ( SELECT COALESCE(sum(comisiones.valor_comision), (0)::numeric) AS "coalesce"
           FROM public.comisiones
          WHERE ((comisiones.pedido_id = p.id) AND (comisiones.estado = 'Pendiente'::public.estado_comision))) AS comision_pendiente,
    p.valor_domicilio,
    p.ganancias,
    p.medio_pago,
    p.estado,
    p.notas,
    p.origen
   FROM ((public.pedidos p
     JOIN public.clientes c ON ((c.id = p.cliente_id)))
     JOIN public.usuarios u ON ((u.id = p.vendedor_id)));


ALTER VIEW public.v_pedidos_resumen OWNER TO postgres;

--
-- Data for Name: pedidos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pedidos (id, fecha_venta, fecha_entrega, valor_venta, costo, comision, valor_domicilio, ganancias, cliente_id, vendedor_id, domiciliario, medio_pago, estado, origen, notas, created_at, updated_at, costos_otros) FROM stdin;
PD0054	2026-08-22 23:08:11.7971+00	2026-08-22	288000.00	204000.00	0.00	10000.00	74000.00	CL0027	US0011	\N	Nequi	entregado	\N	\N	2026-08-22 23:08:11.7971+00	2026-08-26 06:00:15.540245+00	0.00
PD0059	2026-08-29 20:41:14.780853+00	2026-08-12	130000.00	0.00	0.00	0.00	0.00	CL0031	US0005	\N	Efectivo	por_confirmar	\N	asc	2026-08-29 20:41:14.780853+00	2026-08-29 20:42:23.878393+00	0.00
PD0051	2026-08-21 04:11:33.819874+00	2026-08-20	390000.00	224400.00	0.00	20000.00	145600.00	CL0024	US0005	\N	Nequi	entregado	\N	\N	2026-08-21 04:11:33.819874+00	2026-08-23 18:51:54.111858+00	0.00
PD0052	2026-08-22 22:40:25.400838+00	2026-08-21	360000.00	241600.00	0.00	17500.00	100900.00	CL0025	US0008	\N	Nequi	entregado	\N	\N	2026-08-22 22:40:25.400838+00	2026-08-23 18:54:21.295998+00	0.00
PD0053	2026-08-22 22:58:08.957141+00	2026-08-21	165000.00	99600.00	0.00	17500.00	47900.00	CL0026	US0008	\N	Nequi	entregado	\N	\N	2026-08-22 22:58:08.957141+00	2026-08-23 18:55:45.368092+00	0.00
PD0057	2026-08-24 04:49:15.038599+00	2026-08-23	195000.00	131000.00	0.00	20000.00	44000.00	CL0030	US0008	\N	Efectivo	entregado	\N	\N	2026-08-24 04:49:15.038599+00	2026-08-26 05:52:53.867594+00	0.00
PD0055	2026-08-22 23:35:58.744485+00	2026-08-22	155000.00	92800.00	0.00	21000.00	41200.00	CL0028	US0008	\N	Nequi	entregado	\N	\N	2026-08-22 23:35:58.744485+00	2026-08-26 05:55:45.245363+00	0.00
PD0050	2026-08-21 03:48:51.084269+00	2026-08-22	180000.00	107000.00	0.00	20000.00	53000.00	CL0023	US0008	\N	Transferencia	entregado	\N	\N	2026-08-21 03:48:51.084269+00	2026-08-24 02:06:58.427773+00	0.00
\.


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);


--
-- Name: idx_pedidos_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pedidos_cliente ON public.pedidos USING btree (cliente_id);


--
-- Name: idx_pedidos_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pedidos_estado ON public.pedidos USING btree (estado);


--
-- Name: idx_pedidos_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pedidos_fecha ON public.pedidos USING btree (fecha_venta DESC);


--
-- Name: idx_pedidos_vendedor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pedidos_vendedor ON public.pedidos USING btree (vendedor_id);


--
-- Name: pedidos trg_pedidos_ganancias; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_pedidos_ganancias BEFORE INSERT OR UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_ganancias();


--
-- Name: pedidos trg_pedidos_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: pedidos pedidos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON UPDATE CASCADE;


--
-- Name: pedidos pedidos_vendedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict hekuYXkYHzS4WOvClChh2x6L6eNsxJfbMT4uhmcWyMlGKJj0KBTiy4tK2RoTyMz

