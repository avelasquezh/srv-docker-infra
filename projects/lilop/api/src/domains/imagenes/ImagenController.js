const BaseController = require('../../core/BaseController');

/**
 * ImagenController — capa HTTP del dominio imagenes. Las validaciones
 * de forma (archivo presente, extensión, nombre seguro) son decisiones
 * HTTP (qué código devolver) y viven aquí, igual que `notFound()` en
 * ProductoController — no requieren pasar por el try/catch genérico
 * de `handle()`, que está pensado para errores inesperados (I/O, etc).
 */
class ImagenController extends BaseController {
  constructor(service) {
    super(service);
    this.upload = this.handle(this.upload.bind(this));
    this.eliminar = this.handle(this.eliminar.bind(this));
  }

  async upload(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }
    if (!this.service.extensionValida(req.file.originalname)) {
      return res.status(400).json({ error: 'Formato no permitido. Usa JPG, PNG o WebP' });
    }
    const resultado = await this.service.subir(req.file.buffer);
    res.status(201).json(resultado);
  }

  async eliminar(req, res) {
    const { filename } = req.params;
    if (!this.service.nombreArchivoSeguro(filename)) {
      return res.status(400).json({ error: 'Nombre de archivo inválido' });
    }
    this.service.eliminar(filename);
    res.json({ ok: true });
  }
}

module.exports = ImagenController;
