const router = require('express').Router({ mergeParams: true });
const { auth } = require('../middleware/auth');
const { listar, obtener, crear, actualizar, eliminar, catalogo } = require('../controllers/productos');
const comprasRoutes = require('../domains/compras/compras.routes');

router.get('/catalogo', auth, catalogo);
router.get('/',     auth, listar);
router.get('/:id',  auth, obtener);
router.post('/',    auth, crear);
router.put('/:id',  auth, actualizar);
router.delete('/:id', auth, eliminar);

router.use('/:producto_id/compras', comprasRoutes);

module.exports = router;
