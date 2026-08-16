'use strict';
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const UPLOADS_DIR = path.join('/app/uploads/disenos');

const uploadImagen = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  const ext      = path.extname(req.file.originalname).toLowerCase();
  const allowed  = ['.jpg', '.jpeg', '.png', '.webp'];
  if (!allowed.includes(ext)) {
    return res.status(400).json({ error: 'Formato no permitido. Usa JPG, PNG o WebP' });
  }

  const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fileName = `${baseName}.webp`;
  const thumbName = `${baseName}_thumb.webp`;

  try {
    // Versión optimizada
    await sharp(req.file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(UPLOADS_DIR, fileName));

    // Thumbnail
    await sharp(req.file.buffer)
      .resize({ width: 400, height: 400, fit: 'cover' })
      .webp({ quality: 75 })
      .toFile(path.join(UPLOADS_DIR, thumbName));

    res.status(201).json({
      url:       `/uploads/disenos/${fileName}`,
      thumbnail: `/uploads/disenos/${thumbName}`,
    });
  } catch (err) {
    console.error('Error procesando imagen:', err.message);
    res.status(500).json({ error: 'Error al procesar la imagen' });
  }
};

const eliminarImagen = (req, res) => {
  const { filename } = req.params;
  // Validar que no salga del directorio
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Nombre de archivo inválido' });
  }
  const filePath  = path.join(UPLOADS_DIR, filename);
  const thumbPath = path.join(UPLOADS_DIR, filename.replace('.webp', '_thumb.webp'));

  try {
    if (fs.existsSync(filePath))  fs.unlinkSync(filePath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error eliminando imagen:', err.message);
    res.status(500).json({ error: 'Error al eliminar la imagen' });
  }
};

module.exports = { uploadImagen, eliminarImagen };
