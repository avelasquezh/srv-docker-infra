const router = require('express').Router({ mergeParams: true });
const { auth } = require('../middleware/auth');
const {
  listar, agregarDomicilio, agregarComision, eliminarComision, agregarOtro, eliminarOtro, eliminarDomicilio, listaDomiciliarios, listaVendedoresComision, listaConceptosOtros
} = require('../controllers/costos_pedido');

router.get('/',                  auth, listar);
router.post('/domicilio',        auth, agregarDomicilio);
router.post('/comision',         auth, agregarComision);
router.post('/otros',            auth, agregarOtro);
router.delete('/otros/:id',      auth, eliminarOtro);
router.delete('/domicilio/:id',  auth, eliminarDomicilio);
router.delete('/comision/:id',       auth, eliminarComision);
router.get('/listas/domiciliarios', auth, listaDomiciliarios);
router.get('/listas/comisiones',    auth, listaVendedoresComision);
router.get('/listas/conceptos',     auth, listaConceptosOtros);
router.get('/listas/conceptos',     auth, listaConceptosOtros);

module.exports = router;
