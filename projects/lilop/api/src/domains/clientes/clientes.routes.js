const express = require('express');
const pool = require('../../config/db');
const { auth } = require('../../middleware/auth');

const ClienteRepository = require('./ClienteRepository');
const ClienteService = require('./ClienteService');
const ClienteController = require('./ClienteController');

const controller = new ClienteController(new ClienteService({ clientes: new ClienteRepository(pool) }));

const router = express.Router();
router.get('/', auth, controller.listar);
router.get('/:id', auth, controller.obtener);
router.get('/listas/origenes', auth, controller.listaOrigenes);
router.get('/:id/pedidos', auth, controller.pedidos);
router.post('/', auth, controller.crear);
router.put('/:id', auth, controller.actualizar);
router.delete('/:id', auth, controller.eliminar);

module.exports = router;
