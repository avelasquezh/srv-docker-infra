const express = require('express');
const pool = require('../../config/db');
const { auth } = require('../../middleware/auth');

const CompraRepository = require('./CompraRepository');
const CompraService = require('./CompraService');
const CompraController = require('./CompraController');

const controller = new CompraController(new CompraService({ compras: new CompraRepository(pool) }));

const router = express.Router({ mergeParams: true });
router.get('/', auth, controller.listar);
router.get('/:id', auth, controller.obtener);
router.post('/', auth, controller.crear);
router.put('/:id', auth, controller.actualizar);
router.delete('/:id', auth, controller.eliminar);

module.exports = router;
