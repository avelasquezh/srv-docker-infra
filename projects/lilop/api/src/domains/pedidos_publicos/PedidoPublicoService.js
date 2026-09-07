const BaseService = require('../../core/BaseService');

const VENDEDOR_WEB_ID = 'US0002'; // Arley — vendedor asignado a pedidos de lilop.store
const TAMANIOS_VALIDOS = ['Sencillo', 'Doble', 'Queen', 'King', 'Unico', 'Semidoble'];
const MAPA_MEDIO_PAGO = {
  mercadopago: 'Mercado Pago',
  transfer: 'Transferencia',
  whatsapp: 'Contraentrega',
};

class PedidoPublicoService extends BaseService {
  extraerTamanio(variant) {
    if (!variant) return null;
    return TAMANIOS_VALIDOS.find((t) => variant.includes(t)) || null;
  }

  getMinFechaEntrega() {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 3);
    return d.toISOString().split('T')[0];
  }

  async crear(datos) {
    const {
      firstName, lastName, email, phone, city, department, localidad,
      address, neighborhood, apartment, notes, paymentMethod, items, deliveryDate,
    } = datos;

    const medioPagoNombre = MAPA_MEDIO_PAGO[paymentMethod] || 'Por confirmar';
    const repo = this.repos.pedidosPublicos;

    return repo.transaction(async (client) => {
      const nombreCompleto = `${firstName} ${lastName}`.trim();
      let clienteId = await repo.buscarClientePorCelular(client, phone);
      if (clienteId) {
        await repo.actualizarCliente(client, clienteId, { city, department, address, neighborhood, localidad });
      } else {
        clienteId = await repo.crearCliente(client, { nombreCompleto, phone, city, department, localidad, address, neighborhood });
      }

      const medioPagoId = await repo.obtenerMedioPagoId(client, medioPagoNombre);

      const notasCompletas = [
        `Email: ${email || 'no proporcionado'}`,
        apartment ? `Apto/Interior: ${apartment}` : null,
        notes ? `Notas del cliente: ${notes}` : null,
      ].filter(Boolean).join(' | ');

      const pedidoId = await repo.crearPedido(client, {
        clienteId, vendedorId: VENDEDOR_WEB_ID, medioPagoId, notas: notasCompletas, fechaEntrega: deliveryDate,
      });

      for (const item of items) {
        await repo.crearProducto(client, pedidoId, {
          nombre: item.name,
          tamanio: this.extraerTamanio(item.variant),
          diseno: item.design || null,
          valorVentaOverride: item.price * (item.quantity || 1),
          cantidad: item.quantity || 1,
        });
      }

      return { pedidoId, clienteId };
    });
  }
}

module.exports = PedidoPublicoService;
