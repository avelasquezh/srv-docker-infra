const BaseRepository = require('../../core/BaseRepository');

/**
 * CostoPedidoRepository — acceso a datos de las 3 tablas que maneja
 * este dominio (costos_pedido "otros", entregas "domicilio",
 * comisiones), agrupadas porque comparten el mismo padre de ruta
 * (`/api/pedidos/:pedido_id/costos`) y el mismo endpoint compuesto
 * de listado. No conoce Express ni los triggers de recálculo — esos
 * viven en la base de datos (ver migraciones 004/007) y son la única
 * fuente de verdad para pedidos.comision/valor_domicilio/costos_otros;
 * este repositorio nunca debe duplicar ese cálculo (ver entrada #29
 * del MD — mismo bug ya corregido dos veces).
 */
class CostoPedidoRepository extends BaseRepository {
  // ---- otros costos ----
  async listarOtros(pedidoId) {
    const { rows } = await this.query('SELECT * FROM costos_pedido WHERE pedido_id = $1 ORDER BY created_at', [pedidoId]);
    return rows;
  }

  async crearOtro(pedidoId, { nombre, valor }) {
    const { rows } = await this.query(
      'INSERT INTO costos_pedido (pedido_id, nombre, valor) VALUES ($1, $2, $3) RETURNING *',
      [pedidoId, nombre, valor]
    );
    return rows[0];
  }

  async eliminarOtro(id) {
    await this.query('DELETE FROM costos_pedido WHERE id = $1', [id]);
  }

  async listaConceptosOtros() {
    const { rows } = await this.query('SELECT nombre FROM conceptos_costo ORDER BY nombre');
    return rows.map(r => r.nombre);
  }

  // ---- domicilio (entregas) ----
  async listarEntregas(pedidoId) {
    const { rows } = await this.query('SELECT * FROM entregas WHERE pedido_id = $1 ORDER BY created_at', [pedidoId]);
    return rows;
  }

  async crearEntrega(pedidoId, { valorDomicilio, domiciliario, notas }) {
    const { rows } = await this.query(
      `INSERT INTO entregas (pedido_id, valor_domicilio, domiciliario, notas)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [pedidoId, valorDomicilio, domiciliario || null, notas || null]
    );
    return rows[0];
  }

  async eliminarEntrega(id) {
    await this.query('DELETE FROM entregas WHERE id = $1', [id]);
  }

  async cambiarEstadoPagoEntrega(id, estadoPago) {
    const { rows } = await this.query(
      'UPDATE entregas SET estado_pago = $1 WHERE id = $2 RETURNING *',
      [estadoPago, id]
    );
    return rows[0] || null;
  }

  async listaDomiciliarios() {
    const { rows } = await this.query(
      'SELECT DISTINCT domiciliario FROM entregas WHERE domiciliario IS NOT NULL ORDER BY domiciliario'
    );
    return rows.map(r => r.domiciliario);
  }

  // ---- comisiones (manuales) ----
  async listarComisiones(pedidoId) {
    const { rows } = await this.query('SELECT * FROM comisiones WHERE pedido_id = $1 ORDER BY created_at', [pedidoId]);
    return rows;
  }

  async crearComision(pedidoId, { valorComision, nombreVendedor }) {
    await this.query(
      'INSERT INTO comisiones (pedido_id, nombre_vendedor, valor_comision) VALUES ($1, $2, $3)',
      [pedidoId, nombreVendedor || null, valorComision]
    );
  }

  async eliminarComision(id) {
    await this.query('DELETE FROM comisiones WHERE id = $1', [id]);
  }

  async cambiarEstadoComision(id, estado) {
    const { rows } = await this.query(
      'UPDATE comisiones SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    );
    return rows[0] || null;
  }

  async listaVendedoresComision() {
    const { rows } = await this.query(
      'SELECT DISTINCT nombre_vendedor FROM comisiones WHERE nombre_vendedor IS NOT NULL ORDER BY nombre_vendedor'
    );
    return rows.map(r => r.nombre_vendedor);
  }
}

module.exports = CostoPedidoRepository;
