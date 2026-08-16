'use strict';
const router = require('express').Router();
const multer = require('multer');
const { auth } = require('../middleware/auth');
const { uploadImagen, eliminarImagen } = require('../controllers/imagenes');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
});

router.post('/upload', auth, upload.single('imagen'), uploadImagen);
router.delete('/:filename', auth, eliminarImagen);

module.exports = router;
