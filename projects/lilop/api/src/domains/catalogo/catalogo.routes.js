const express = require('express');
const pool = require('../../config/db');
const { auth } = require('../../middleware/auth');

const CatalogoRepository = require('./CatalogoRepository');
const CatalogoService = require('./CatalogoService');
const CatalogoController = require('./CatalogoController');

/**
 * Composition root del dominio: instancia las clases concretas con
 * el pool real. Reemplaza a controllers/catalogo.js + routes/catalogo.js
 * (versión funcional) — mismas 6 rutas admin bajo `/api/catalogo`,
 * más `listarPublico` expuesto en `.controller` para el endpoint
 * público `/api/public/productos` (mismo patrón que `atributos`,
 * ver index.js).
 */
const controller = new CatalogoController(
  new CatalogoService({ catalogo: new CatalogoRepository(pool) })
);

const router = express.Router();

router.get('/',                      auth, controller.listar);
router.post('/',                     auth, controller.crear);
router.patch('/:id/toggle',          auth, controller.toggleActivo);
router.put('/:id',                   auth, controller.actualizar);
router.delete('/:id',                auth, controller.eliminar);
router.post('/:catalogo_id/precios', auth, controller.upsertPrecio);

module.exports = { router, controller };
