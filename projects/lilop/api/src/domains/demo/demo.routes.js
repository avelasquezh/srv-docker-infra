const express = require('express');
const pool = require('../../config/db');

const DemoRepository = require('./DemoRepository');
const DemoService = require('./DemoService');
const DemoController = require('./DemoController');

/**
 * Composition root del dominio: instancia con el pool real y la URL
 * del webhook desde env var (ya venía de env var en el código viejo,
 * N8N_DEMO_WEBHOOK — no requiere des-hardcodeo adicional).
 * Reemplaza a controllers/demo.js + routes/demo.js (versión funcional)
 * — mismas rutas, sin auth (igual que antes), sin cambios de contrato.
 */
const demoRepository = new DemoRepository(pool);
const demoService = new DemoService(
  { demo: demoRepository },
  { webhookUrl: process.env.N8N_DEMO_WEBHOOK }
);
const demoController = new DemoController(demoService);

const router = express.Router();
router.post('/run',       demoController.run);
router.get('/status/:id', demoController.status);
router.patch('/step/:id', demoController.updateStep);

module.exports = router;
