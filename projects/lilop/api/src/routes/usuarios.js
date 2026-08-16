const router = require('express').Router();
const { auth, soloAdmin } = require('../middleware/auth');
const { listar, obtener, crear, actualizar, cambiarPassword, eliminar } = require('../controllers/usuarios');

router.get('/',          auth, soloAdmin, listar);
router.get('/:id',       auth, soloAdmin, obtener);
router.post('/',         auth, soloAdmin, crear);
router.put('/:id',       auth, soloAdmin, actualizar);
router.patch('/:id/password', auth, soloAdmin, cambiarPassword);
router.delete('/:id',    auth, soloAdmin, eliminar);

module.exports = router;
