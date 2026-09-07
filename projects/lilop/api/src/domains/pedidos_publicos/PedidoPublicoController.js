const BaseController = require('../../core/BaseController');

class PedidoPublicoController extends BaseController {
  constructor(service) {
    super(service);
    this.crear = this.handle(this.crear.bind(this));
  }

  async crear(req, res) {
    const {
      firstName, lastName, email, phone,
      city, department, localidad, address, neighborhood, apartment, notes,
      paymentMethod, items, deliveryDate,
    } = req.body;

    if (!firstName || !lastName || !email || !phone || !department || !city ||
        !localidad || !neighborhood || !address || !apartment) {
      return res.status(400).json({ error: 'Faltan campos obligatorios del cliente' });
    }
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });
    }
    if (!deliveryDate) {
      return res.status(400).json({ error: 'La fecha de entrega es obligatoria' });
    }
    const minFechaEntrega = this.service.getMinFechaEntrega();
    if (deliveryDate < minFechaEntrega) {
      return res.status(400).json({ error: `La fecha de entrega debe ser ${minFechaEntrega} o posterior (mínimo 3 días después de la compra)` });
    }

    const { pedidoId, clienteId } = await this.service.crear({
      firstName, lastName, email, phone, city, department, localidad,
      address, neighborhood, apartment, notes, paymentMethod, items, deliveryDate,
    });
    res.status(201).json({ ok: true, pedido_id: pedidoId, cliente_id: clienteId });
  }
}

module.exports = PedidoPublicoController;
