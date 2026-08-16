const router = require('express').Router({ mergeParams: true });
const { auth } = require('../middleware/auth');
const { listar, obtener, crear, actualizar, eliminar } = require('../controllers/compras');

router.get('/',       auth, listar);
router.get('/:id',    auth, obtener);
router.post('/',      auth, crear);
router.put('/:id',    auth, actualizar);
router.delete('/:id', auth, eliminar);

module.exports = router;
