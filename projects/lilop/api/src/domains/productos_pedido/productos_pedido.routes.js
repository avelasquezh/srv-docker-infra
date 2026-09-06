const express = require('express');
const pool = require('../../config/db');
const { auth } = require('../../middleware/auth');

const ProductoPedidoRepository = require('./ProductoPedidoRepository');
const ProductoPedidoService = require('./ProductoPedidoService');
const ProductoPedidoController = require('./ProductoPedidoController');

const controller = new ProductoPedidoController(
  new ProductoPedidoService({ productos: new ProductoPedidoRepository(pool) })
);

// mergeParams: true — necesario porque este router se monta anidado bajo
// /api/pedidos/:pedido_id/productos y necesita leer :pedido_id del padre
// (mismo requisito que tenía routes/productos.js original).
const router = express.Router({ mergeParams: true });

router.get('/catalogo', auth, controller.catalogo);
router.get('/',     auth, controller.listar);
router.get('/:id',  auth, controller.obtener);
router.post('/',    auth, controller.crear);
router.put('/:id',  auth, controller.actualizar);
router.delete('/:id', auth, controller.eliminar);

// Sub-recurso `compras` — migrado a domains/compras/ por otra sesión
// mientras se hacía este refactor de pedidos/productos_pedido.
router.use('/:producto_id/compras', require('../compras/compras.routes'));

// Se exporta también `controller` para el endpoint standalone
// `/api/productos/catalogo` montado directo en index.js (mismo handler,
// dos rutas distintas — igual que el controller original).
module.exports = { router, controller };
