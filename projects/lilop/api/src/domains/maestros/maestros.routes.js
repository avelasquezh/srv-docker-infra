const express = require('express');
const pool = require('../../config/db');
const { auth, soloAdmin } = require('../../middleware/auth');

const CatalogoSimpleRepository = require('./CatalogoSimpleRepository');
const CategoriaRepository = require('./CategoriaRepository');
const { MaestroService } = require('./MaestroService');
const MaestroController = require('./MaestroController');

/**
 * Composition root del dominio: aquí, y SOLO aquí, se instancian las
 * clases concretas con el pool real de Postgres. Reemplaza a
 * controllers/maestros.js + routes/maestros.js (versión funcional) —
 * mismas rutas, mismo middleware (auth/soloAdmin) por ruta, sin
 * cambios de contrato.
 */
const origenesRepository = new CatalogoSimpleRepository(pool, 'origenes_venta');
const conceptosCostoRepository = new CatalogoSimpleRepository(pool, 'conceptos_costo');
const conceptosCompraRepository = new CatalogoSimpleRepository(pool, 'conceptos_compra');
const categoriaRepository = new CategoriaRepository(pool);

const maestroService = new MaestroService({
  origenes: origenesRepository,
  conceptosCosto: conceptosCostoRepository,
  conceptosCompra: conceptosCompraRepository,
  categorias: categoriaRepository,
});
const maestroController = new MaestroController(maestroService);

const router = express.Router();

router.get('/origenes',                auth, maestroController.listarOrigenes);
router.post('/origenes',               auth, soloAdmin, maestroController.crearOrigen);
router.delete('/origenes/:id',         auth, soloAdmin, maestroController.eliminarOrigen);

router.get('/conceptos',               auth, maestroController.listarConceptos);
router.post('/conceptos',              auth, soloAdmin, maestroController.crearConcepto);
router.delete('/conceptos/:id',        auth, soloAdmin, maestroController.eliminarConcepto);

router.get('/conceptos-compra',        auth, maestroController.listarConceptosCompra);
router.post('/conceptos-compra',       auth, maestroController.crearConceptoCompra);
router.delete('/conceptos-compra/:id', auth, maestroController.eliminarConceptoCompra);

router.get('/categorias',              auth, maestroController.listarCategorias);
router.post('/categorias',             auth, maestroController.crearCategoria);
router.put('/categorias/:id',          auth, maestroController.actualizarCategoria);
router.delete('/categorias/:id',       auth, maestroController.eliminarCategoria);

module.exports = router;
