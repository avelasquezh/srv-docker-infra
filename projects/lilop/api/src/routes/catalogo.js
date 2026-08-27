const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { listar, upsertPrecio, crearProducto, actualizarProducto, toggleActivo, eliminarProducto } = require('../controllers/catalogo');

router.get('/',                      auth, listar);
router.post('/',                     auth, crearProducto);
router.patch('/:id/toggle',          auth, toggleActivo);
router.put('/:id',                   auth, actualizarProducto);
router.delete('/:id',                auth, eliminarProducto);
router.post('/:catalogo_id/precios', auth, upsertPrecio);

module.exports = router;
