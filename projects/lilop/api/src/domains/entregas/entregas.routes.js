const express = require('express');
const pool = require('../../config/db');
const { auth } = require('../../middleware/auth');

const EntregaRepository = require('./EntregaRepository');
const EntregaService = require('./EntregaService');
const EntregaController = require('./EntregaController');

const controller = new EntregaController(new EntregaService({ entregas: new EntregaRepository(pool) }));

const router = express.Router({ mergeParams: true });
router.get('/', auth, controller.listar);
router.get('/:id', auth, controller.obtener);
router.post('/', auth, controller.crear);
router.put('/:id', auth, controller.actualizar);
router.delete('/:id', auth, controller.eliminar);

module.exports = router;
