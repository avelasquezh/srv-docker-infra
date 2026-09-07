const pool = require('../../config/db');

const PedidoPublicoRepository = require('./PedidoPublicoRepository');
const PedidoPublicoService = require('./PedidoPublicoService');
const PedidoPublicoController = require('./PedidoPublicoController');

const controller = new PedidoPublicoController(
  new PedidoPublicoService({ pedidosPublicos: new PedidoPublicoRepository(pool) })
);

module.exports = { crearPedidoPublico: controller.crear };
