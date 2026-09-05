const path = require('path');
const BaseService = require('../../core/BaseService');

const EXTENSIONES_PERMITIDAS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * ImagenService — reglas de negocio del dominio imagenes: qué formatos
 * se aceptan, cómo se nombran los archivos, y el contrato de salida
 * (url + thumbnail). No conoce Express ni sharp/fs directo — eso vive
 * en el repositorio inyectado por constructor.
 */
class ImagenService extends BaseService {
  /** true si la extensión del nombre original está permitida. */
  extensionValida(nombreOriginal) {
    const ext = path.extname(nombreOriginal).toLowerCase();
    return EXTENSIONES_PERMITIDAS.includes(ext);
  }

  /** true si el nombre de archivo es seguro (no sale del directorio de uploads). */
  nombreArchivoSeguro(filename) {
    return !filename.includes('..') && !filename.includes('/');
  }

  /**
   * Procesa el buffer subido: genera versión optimizada + thumbnail,
   * y devuelve el contrato { url, thumbnail } que el admin espera.
   */
  async subir(buffer) {
    const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const fileName = `${baseName}.webp`;
    const thumbName = `${baseName}_thumb.webp`;

    await this.repos.imagenes.guardarOptimizada(buffer, fileName);
    await this.repos.imagenes.guardarThumbnail(buffer, thumbName);

    return {
      url: `/uploads/disenos/${fileName}`,
      thumbnail: `/uploads/disenos/${thumbName}`,
    };
  }

  /** Elimina la imagen y su thumbnail asociado. */
  eliminar(filename) {
    this.repos.imagenes.eliminarSiExiste(filename);
    this.repos.imagenes.eliminarSiExiste(filename.replace('.webp', '_thumb.webp'));
  }
}

module.exports = ImagenService;
