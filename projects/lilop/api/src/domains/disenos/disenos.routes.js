const express = require('express');
const pool = require('../../config/db');
const { auth } = require('../../middleware/auth');

const DisenoRepository = require('./DisenoRepository');
const DisenoService = require('./DisenoService');
const DisenoController = require('./DisenoController');

const controller = new DisenoController(new DisenoService({ disenos: new DisenoRepository(pool) }));

const router = express.Router();
router.get('/', auth, controller.listar);
router.post('/', auth, controller.crear);
router.put('/:id', auth, controller.actualizar);
router.delete('/:id', auth, controller.eliminar);
router.get('/:id/productos', auth, controller.listarProductos);
router.put('/:id/productos', auth, controller.actualizarProductos);

module.exports = router;
