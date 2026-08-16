const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { listar, obtener, crear, actualizar, eliminar, pedidos , listaOrigenes } = require('../controllers/clientes');

router.get('/',               auth, listar);
router.get('/:id',            auth, obtener);
router.get('/listas/origenes', auth, listaOrigenes);
router.get('/:id/pedidos',    auth, pedidos);
router.post('/',              auth, crear);
router.put('/:id',            auth, actualizar);
router.delete('/:id',         auth, eliminar);

module.exports = router;
