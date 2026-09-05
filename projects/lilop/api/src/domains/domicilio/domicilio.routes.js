const express = require('express');
const { auth } = require('../../middleware/auth');

const DomicilioRepository = require('./DomicilioRepository');
const DomicilioService = require('./DomicilioService');
const DomicilioController = require('./DomicilioController');

/**
 * Composition root del dominio: aquí, y SOLO aquí, se instancian las
 * clases concretas con sus dependencias reales. La URL viene de env var
 * con el valor actual como default — primer paso del des-hardcodeo
 * (arquetipo vendible, sección 3/8 del MD): nunca queda un cliente con
 * "lilop" en una URL que no pueda cambiar sin tocar código.
 *
 * Reemplaza a controllers/domicilio.js (versión funcional) — mismo
 * comportamiento en el happy path, sin cambios de contrato de entrada
 * ni de payload al webhook.
 */
const WEBHOOK_URL =
  process.env.DOMICILIO_WEBHOOK_URL || 'https://n8n.autokore.space/webhook/envwdomlilop';

const domicilioRepository = new DomicilioRepository(WEBHOOK_URL);
const domicilioService = new DomicilioService({ domicilio: domicilioRepository });
const domicilioController = new DomicilioController(domicilioService);

const router = express.Router();
router.post('/:id/domicilio-webhook', auth, domicilioController.enviar);

module.exports = router;
