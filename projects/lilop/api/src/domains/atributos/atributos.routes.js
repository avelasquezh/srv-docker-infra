const express = require('express');
const pool = require('../../config/db');
const { auth } = require('../../middleware/auth');

const AtributoRepository = require('./AtributoRepository');
const AtributoService = require('./AtributoService');
const AtributoController = require('./AtributoController');

const controller = new AtributoController(new AtributoService({ atributos: new AtributoRepository(pool) }));

const router = express.Router();
router.get('/', auth, controller.listar);
router.post('/', auth, controller.crear);
router.put('/:id', auth, controller.actualizar);
router.delete('/:id', auth, controller.eliminar);
router.post('/:id/opciones', auth, controller.crearOpcion);
router.delete('/:id/opciones/:opcionId', auth, controller.eliminarOpcion);
router.get('/producto/:catalogo_id', auth, controller.listarPorProducto);
router.put('/producto/:catalogo_id', auth, controller.actualizarAtributosProducto);

module.exports = { router, controller };
