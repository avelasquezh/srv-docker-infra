const express = require('express');
const pool = require('../../config/db');
const { auth } = require('../../middleware/auth');

const PedidoRepository = require('./PedidoRepository');
const { PedidoService } = require('./PedidoService');
const PedidoController = require('./PedidoController');

const controller = new PedidoController(new PedidoService({ pedidos: new PedidoRepository(pool) }));

const router = express.Router();

router.get('/',             auth, controller.listar);
router.get('/:id',          auth, controller.obtener);
router.post('/',            auth, controller.crear);
router.put('/:id',          auth, controller.actualizar);
router.patch('/:id/estado', auth, controller.cambiarEstado);
router.delete('/:id',       auth, controller.eliminar);

// Sub-recursos anidados — mismo esquema exacto del router original
// (routes/pedidos.js), solo cambian las rutas relativas de los require.
router.use('/:pedido_id/productos', require('../productos_pedido/productos_pedido.routes').router);
router.use('/:pedido_id/costos',    require('../costos_pedido/costos_pedido.routes')); // migrado por otra sesión mientras se hacía este refactor
router.use('/:pedido_id/entregas',  require('../entregas/entregas.routes'));

router.use(require('../domicilio/domicilio.routes'));

module.exports = router;
