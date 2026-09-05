const path = require('path');

/**
 * ImagenRepository — capa de "acceso a datos" del dominio imagenes: el
 * dato aquí es el filesystem (vía `sharp` + `fs`), no Postgres. Igual
 * que DomicilioRepository, deliberadamente NO extiende BaseRepository
 * (ese contrato es de `pool.query`; forzar la herencia violaría
 * Liskov). Inversión de Dependencias a mano: `sharp` y `fs` se inyectan
 * por constructor — permite testear sin tocar disco real.
 */
class ImagenRepository {
  /**
   * @param {string} uploadsDir - directorio absoluto de destino, inyectado
   * @param {typeof import('sharp')} sharpImpl
   * @param {typeof import('fs')} fsImpl
   */
  constructor(uploadsDir, sharpImpl, fsImpl) {
    if (!uploadsDir) {
      throw new Error('ImagenRepository: se requiere uploadsDir inyectado');
    }
    this.uploadsDir = uploadsDir;
    this.sharp = sharpImpl;
    this.fs = fsImpl;
  }

  /** Guarda la versión optimizada (max 1200px de ancho) en WebP. */
  async guardarOptimizada(buffer, fileName) {
    await this.sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(this.uploadsDir, fileName));
  }

  /** Guarda el thumbnail (400x400 cover) en WebP. */
  async guardarThumbnail(buffer, thumbName) {
    await this.sharp(buffer)
      .resize({ width: 400, height: 400, fit: 'cover' })
      .webp({ quality: 75 })
      .toFile(path.join(this.uploadsDir, thumbName));
  }

  /** Elimina un archivo del directorio de uploads si existe (silencioso si no). */
  eliminarSiExiste(fileName) {
    const filePath = path.join(this.uploadsDir, fileName);
    if (this.fs.existsSync(filePath)) this.fs.unlinkSync(filePath);
  }
}

module.exports = ImagenRepository;
