const express = require('express');
const pool = require('../../config/db');
const { auth, soloAdmin } = require('../../middleware/auth');

const ComisionRepository = require('./ComisionRepository');
const ComisionService = require('./ComisionService');
const ComisionController = require('./ComisionController');

const controller = new ComisionController(new ComisionService({ comisiones: new ComisionRepository(pool) }));

const router = express.Router();
router.get('/', auth, soloAdmin, controller.listar);
router.get('/:id', auth, soloAdmin, controller.obtener);
router.patch('/:id/estado', auth, soloAdmin, controller.cambiarEstado);
router.get('/vendedor/:vendedor_id', auth, controller.resumenVendedor);

module.exports = router;
