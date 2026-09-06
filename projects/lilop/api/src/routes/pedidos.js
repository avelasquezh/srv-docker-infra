const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { listar, obtener, crear, actualizar, cambiarEstado, eliminar } = require('../controllers/pedidos');
const productosRoutes = require('./productos');
const entregasRoutes  = require('../domains/entregas/entregas.routes');

router.get('/',                  auth, listar);
router.get('/:id',               auth, obtener);
router.post('/',                 auth, crear);
router.put('/:id',               auth, actualizar);
router.patch('/:id/estado',      auth, cambiarEstado);
router.delete('/:id',            auth, eliminar);

router.use('/:pedido_id/productos', productosRoutes);
router.use('/:pedido_id/costos',    require('../domains/costos_pedido/costos_pedido.routes'));
router.use('/:pedido_id/entregas',  entregasRoutes);

router.use(require('../domains/domicilio/domicilio.routes'));

module.exports = router;
