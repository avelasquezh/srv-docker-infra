const router = require('express').Router();
const { auth, soloAdmin } = require('../middleware/auth');
const { listar, obtener, cambiarEstado, resumenVendedor } = require('../controllers/comisiones');

router.get('/',                        auth, soloAdmin, listar);
router.get('/:id',                     auth, soloAdmin, obtener);
router.patch('/:id/estado',            auth, soloAdmin, cambiarEstado);
router.get('/vendedor/:vendedor_id',   auth, resumenVendedor);

module.exports = router;
