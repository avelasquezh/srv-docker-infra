const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { listar, upsertPrecio, crearProducto, toggleActivo } = require('../controllers/catalogo');

router.get('/',                      auth, listar);
router.post('/',                     auth, crearProducto);
router.patch('/:id/toggle',          auth, toggleActivo);
router.post('/:catalogo_id/precios', auth, upsertPrecio);

module.exports = router;
