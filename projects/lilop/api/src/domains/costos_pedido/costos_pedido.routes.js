const express = require('express');
const pool = require('../../config/db');
const { auth } = require('../../middleware/auth');

const CostoPedidoRepository = require('./CostoPedidoRepository');
const CostoPedidoService = require('./CostoPedidoService');
const CostoPedidoController = require('./CostoPedidoController');

/**
 * Composition root del dominio: instancia las clases concretas con
 * el pool real. Reemplaza a controllers/costos_pedido.js +
 * routes/costos_pedido.js (versión funcional) — mismas 12 rutas,
 * montado igual bajo `/api/pedidos/:pedido_id/costos`
 * (`mergeParams: true`, ver routes/pedidos.js).
 *
 * Se corrige aquí un defecto menor heredado del router viejo: la ruta
 * `/listas/conceptos` estaba registrada DOS VECES (duplicado sin
 * efecto funcional, pero confuso) — queda una sola vez.
 */
const controller = new CostoPedidoController(
  new CostoPedidoService({ costos: new CostoPedidoRepository(pool) })
);

const router = express.Router({ mergeParams: true });

router.get('/',                            auth, controller.listar);
router.post('/domicilio',                  auth, controller.agregarDomicilio);
router.post('/comision',                   auth, controller.agregarComision);
router.post('/otros',                      auth, controller.agregarOtro);
router.delete('/otros/:id',                auth, controller.eliminarOtro);
router.delete('/domicilio/:id',            auth, controller.eliminarDomicilio);
router.delete('/comision/:id',             auth, controller.eliminarComision);
router.patch('/comision/:id/estado',       auth, controller.cambiarEstadoComision);
router.patch('/domicilio/:id/estado-pago', auth, controller.cambiarEstadoPagoDomicilio);
router.get('/listas/domiciliarios',        auth, controller.listaDomiciliarios);
router.get('/listas/comisiones',           auth, controller.listaVendedoresComision);
router.get('/listas/conceptos',            auth, controller.listaConceptosOtros);

module.exports = router;
