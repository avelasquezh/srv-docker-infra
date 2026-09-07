/**
 * BaseRepository — clase base para toda la capa de acceso a datos.
 *
 * Principio aplicado: Inversión de Dependencias (D de SOLID). Los
 * repositorios concretos NO importan `../config/db` directamente —
 * reciben el pool de conexión inyectado por constructor. Esto permite
 * testear repositorios con un pool falso/mock sin tocar Postgres real,
 * y es lo que hace posible el patrón de "clonar y validar en paralelo"
 * si algún día se necesita apuntar un repositorio a otra base de datos.
 */
class BaseRepository {
  /**
   * @param {import('pg').Pool} pool - conexión inyectada, nunca importada a mano
   */
  constructor(pool) {
    if (!pool) {
      throw new Error(`${this.constructor.name}: se requiere un pool de conexión inyectado`);
    }
    this.pool = pool;
  }

  /**
   * Wrapper delgado sobre pool.query — punto único donde en el futuro
   * se podría agregar logging/métricas de queries sin tocar cada
   * repositorio concreto (Abierto/Cerrado: se extiende aquí, no en
   * cada clase hija).
   */
  async query(sql, params = []) {
    return this.pool.query(sql, params);
  }

  /**
   * Ejecuta fn(client) dentro de BEGIN/COMMIT/ROLLBACK sobre una conexión
   * dedicada. fn recibe un cliente con el mismo método query(sql, params)
   * que este repositorio, así el código de negocio no distingue entre
   * pool y client. Primer uso: pedidos_publicos (checkout transaccional).
   */
  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const resultado = await fn(client);
      await client.query('COMMIT');
      return resultado;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = BaseRepository;
