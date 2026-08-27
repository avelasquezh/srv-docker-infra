const router = require('express').Router();
const { auth, soloAdmin } = require('../middleware/auth');
const { listarOrigenes, crearOrigen, eliminarOrigen, listarConceptos, crearConcepto, eliminarConcepto, listarConceptosCompra, crearConceptoCompra, eliminarConceptoCompra, listarCategorias, crearCategoria, actualizarCategoria, eliminarCategoria } = require('../controllers/maestros');

router.get('/origenes',        auth, listarOrigenes);
router.post('/origenes',       auth, soloAdmin, crearOrigen);
router.delete('/origenes/:id', auth, soloAdmin, eliminarOrigen);
router.get('/conceptos',       auth, listarConceptos);
router.get('/conceptos-compra',       auth, listarConceptosCompra);
router.post('/conceptos-compra',      auth, crearConceptoCompra);
router.delete('/conceptos-compra/:id', auth, eliminarConceptoCompra);
router.post('/conceptos',      auth, soloAdmin, crearConcepto);
router.delete('/conceptos/:id',auth, soloAdmin, eliminarConcepto);

router.get('/categorias',       auth, listarCategorias);
router.post('/categorias',      auth, crearCategoria);
router.put('/categorias/:id',   auth, actualizarCategoria);
router.delete('/categorias/:id', auth, eliminarCategoria);

module.exports = router;
