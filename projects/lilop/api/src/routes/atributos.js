'use strict';
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const {
  listar, crear, actualizar, eliminar,
  crearOpcion, eliminarOpcion,
  listarPorProducto, actualizarAtributosProducto
} = require('../controllers/atributos');

router.get('/',                                    auth, listar);
router.post('/',                                   auth, crear);
router.put('/:id',                                 auth, actualizar);
router.delete('/:id',                              auth, eliminar);
router.post('/:id/opciones',                       auth, crearOpcion);
router.delete('/:id/opciones/:opcionId',           auth, eliminarOpcion);
router.get('/producto/:catalogo_id',               auth, listarPorProducto);
router.put('/producto/:catalogo_id',               auth, actualizarAtributosProducto);

module.exports = router;
