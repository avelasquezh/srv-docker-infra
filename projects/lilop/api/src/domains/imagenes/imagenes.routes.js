const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const { auth } = require('../../middleware/auth');

const ImagenRepository = require('./ImagenRepository');
const ImagenService = require('./ImagenService');
const ImagenController = require('./ImagenController');

/**
 * Composition root del dominio: aquí, y SOLO aquí, se instancian las
 * clases concretas con sus dependencias reales (sharp/fs reales, no
 * inyecciones falsas de test). El directorio de uploads sale de env
 * var con el valor actual como default — mismo criterio de
 * des-hardcodeo aplicado en el dominio domicilio.
 *
 * Reemplaza a controllers/imagenes.js (versión funcional) — mismo
 * comportamiento en el happy path, sin cambios de contrato.
 */
const UPLOADS_DIR = process.env.IMAGENES_UPLOADS_DIR || '/app/uploads/disenos';

const imagenRepository = new ImagenRepository(UPLOADS_DIR, sharp, fs);
const imagenService = new ImagenService({ imagenes: imagenRepository });
const imagenController = new ImagenController(imagenService);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
});

const router = express.Router();
router.post('/upload', auth, upload.single('imagen'), imagenController.upload);
router.delete('/:filename', auth, imagenController.eliminar);

module.exports = router;
