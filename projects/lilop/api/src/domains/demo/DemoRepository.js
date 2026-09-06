const BaseRepository = require('../../core/BaseRepository');

class DemoRepository extends BaseRepository {
  async crearEjecucion(testCaseId, steps) {
    const { rows } = await this.query(
      `INSERT INTO demo_executions (test_case_id, steps) VALUES ($1, $2) RETURNING id`,
      [testCaseId, JSON.stringify(steps)]
    );
    return rows[0].id;
  }

  async obtenerEstado(id) {
    const { rows } = await this.query(
      `SELECT id, test_case_id, status, result, steps, created_at, completed_at
       FROM demo_executions WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async obtenerSteps(id) {
    const { rows } = await this.query('SELECT steps FROM demo_executions WHERE id = $1', [id]);
    return rows[0] ? rows[0].steps : null;
  }

  async actualizarSteps(id, steps, status, result, completedAt) {
    await this.query(
      `UPDATE demo_executions SET steps = $1, status = $2, result = $3, completed_at = $4 WHERE id = $5`,
      [JSON.stringify(steps), status, result || null, completedAt, id]
    );
  }
}

module.exports = DemoRepository;
