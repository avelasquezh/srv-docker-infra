const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { listar, obtener, crear, actualizar, cambiarEstado, eliminar } = require('../controllers/pedidos');
const { enviarDomicilio } = require('../controllers/domicilio');
const productosRoutes = require('./productos');
const entregasRoutes  = require('./entregas');

router.get('/',                  auth, listar);
router.get('/:id',               auth, obtener);
router.post('/',                 auth, crear);
router.put('/:id',               auth, actualizar);
router.patch('/:id/estado',      auth, cambiarEstado);
router.delete('/:id',            auth, eliminar);

router.use('/:pedido_id/productos', productosRoutes);
router.use('/:pedido_id/costos',    require('./costos_pedido'));
router.use('/:pedido_id/entregas',  entregasRoutes);

router.post('/:id/domicilio-webhook', auth, enviarDomicilio);

module.exports = router;
