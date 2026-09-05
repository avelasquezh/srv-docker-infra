const express = require('express');
const pool = require('../../config/db');

const ProductoRepository = require('./ProductoRepository');
const ProductoService = require('./ProductoService');
const ProductoController = require('./ProductoController');

/**
 * Composition root del dominio: aquí, y SOLO aquí, se instancian las
 * clases concretas con sus dependencias reales (pool de Postgres real).
 * Si mañana se quiere testear el dominio con un pool falso, o apuntar
 * a otra base, este es el único archivo que cambia.
 */
const productoRepository = new ProductoRepository(pool);
const productoService = new ProductoService({ productos: productoRepository });
const productoController = new ProductoController(productoService);

const router = express.Router();
router.get('/productos', productoController.listar);
router.get('/productos/:id', productoController.obtener);

module.exports = router;
