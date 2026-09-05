/**
 * BaseService — clase base para la capa de lógica de negocio.
 *
 * Responsabilidad única: reglas de negocio y forma de los datos.
 * NUNCA conoce Express (req/res) ni SQL directo — eso es trabajo del
 * Controller y del Repository respectivamente. Recibe su(s)
 * repositorio(s) por constructor (misma inversión de dependencias que
 * BaseRepository recibe el pool).
 */
class BaseService {
  /**
   * @param {Record<string, import('./BaseRepository')>} repositorios - repos inyectados por nombre
   */
  constructor(repositorios = {}) {
    this.repos = repositorios;
  }
}

module.exports = BaseService;
