const BaseController = require('../../core/BaseController');

/**
 * CostoPedidoController — capa HTTP. Reemplaza a controllers/costos_pedido.js
 * (versión funcional) — mismo contrato exacto (mismos status codes,
 * mismo shape de respuesta) para cada una de las 12 rutas.
 */
class CostoPedidoController extends BaseController {
  constructor(service) {
    super(service);
    [
      'listar', 'agregarOtro', 'eliminarOtro', 'listaConceptosOtros',
      'agregarDomicilio', 'eliminarDomicilio', 'cambiarEstadoPagoDomicilio', 'listaDomiciliarios',
      'agregarComision', 'eliminarComision', 'cambiarEstadoComision', 'listaVendedoresComision',
    ].forEach((m) => { this[m] = this.handle(this[m].bind(this)); });
  }

  // ---- listado compuesto ----
  async listar(req, res) {
    res.json(await this.service.listarCostos(req.params.pedido_id));
  }

  // ---- otros costos ----
  async agregarOtro(req, res) {
    const { pedido_id } = req.params;
    const { nombre, valor } = req.body;
    if (!nombre || !valor) return res.status(400).json({ error: 'nombre y valor son requeridos' });
    res.status(201).json(await this.service.crearOtro(pedido_id, { nombre, valor }));
  }

  async eliminarOtro(req, res) {
    await this.service.eliminarOtro(req.params.id);
    res.json({ ok: true });
  }

  async listaConceptosOtros(req, res) {
    res.json(await this.service.listaConceptosOtros());
  }

  // ---- domicilio ----
  async agregarDomicilio(req, res) {
    const { pedido_id } = req.params;
    const { valor_domicilio, domiciliario, notas } = req.body;
    if (!valor_domicilio) return res.status(400).json({ error: 'El valor del domicilio es requerido' });
    const entrega = await this.service.crearEntrega(pedido_id, { valorDomicilio: valor_domicilio, domiciliario, notas });
    res.status(201).json(entrega);
  }

  async eliminarDomicilio(req, res) {
    await this.service.eliminarEntrega(req.params.id);
    res.json({ ok: true });
  }

  async cambiarEstadoPagoDomicilio(req, res) {
    const { estado_pago } = req.body;
    if (!['Pendiente', 'Pagado'].includes(estado_pago)) {
      return res.status(400).json({ error: 'Estado de pago inválido' });
    }
    const entrega = await this.service.cambiarEstadoPagoEntrega(req.params.id, estado_pago);
    if (!entrega) return res.status(404).json({ error: 'Entrega no encontrada' });
    res.json(entrega);
  }

  async listaDomiciliarios(req, res) {
    res.json(await this.service.listaDomiciliarios());
  }

  // ---- comisiones ----
  async agregarComision(req, res) {
    const { pedido_id } = req.params;
    const { valor_comision, nombre_vendedor } = req.body;
    if (!valor_comision) return res.status(400).json({ error: 'El valor de la comisión es requerido' });
    await this.service.crearComision(pedido_id, { valorComision: valor_comision, nombreVendedor: nombre_vendedor });
    res.json({ ok: true });
  }

  async eliminarComision(req, res) {
    await this.service.eliminarComision(req.params.id);
    res.json({ ok: true });
  }

  async cambiarEstadoComision(req, res) {
    const { estado } = req.body;
    if (!['Pendiente', 'Pagada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const comision = await this.service.cambiarEstadoComision(req.params.id, estado);
    if (!comision) return res.status(404).json({ error: 'Comisión no encontrada' });
    res.json(comision);
  }

  async listaVendedoresComision(req, res) {
    res.json(await this.service.listaVendedoresComision());
  }
}

module.exports = CostoPedidoController;
