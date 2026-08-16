const router = require('express').Router();
const { auth, soloAdmin } = require('../middleware/auth');
const { listarOrigenes, crearOrigen, eliminarOrigen, listarConceptos, crearConcepto, eliminarConcepto } = require('../controllers/maestros');

router.get('/origenes',        auth, listarOrigenes);
router.post('/origenes',       auth, soloAdmin, crearOrigen);
router.delete('/origenes/:id', auth, soloAdmin, eliminarOrigen);
router.get('/conceptos',       auth, listarConceptos);
router.post('/conceptos',      auth, soloAdmin, crearConcepto);
router.delete('/conceptos/:id',auth, soloAdmin, eliminarConcepto);

module.exports = router;
