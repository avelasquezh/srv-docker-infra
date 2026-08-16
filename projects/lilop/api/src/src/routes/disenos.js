'use strict';
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { listar, crear, actualizar, eliminar, listarProductosDiseno, actualizarProductosDiseno } = require('../controllers/disenos');

router.get('/',       auth, listar);
router.post('/',      auth, crear);
router.put('/:id',    auth, actualizar);
router.delete('/:id', auth, eliminar);

router.get('/:id/productos',  auth, listarProductosDiseno);
router.put('/:id/productos',  auth, actualizarProductosDiseno);

module.exports = router;
