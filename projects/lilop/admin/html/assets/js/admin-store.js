/* ============================================================
   Lilop Admin — admin-store.js
   Estado global del panel. Datos en localStorage.
   Cuando conectes PostgreSQL solo cambia las funciones
   de fetch/save sin tocar el resto del panel.
   ============================================================ */

'use strict';

const AdminStore = {

  /* ─── UTILIDADES ──────────────────────────────────────────── */
  formatPrice(n) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0
    }).format(n);
  },

  formatDate(iso) {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  },

  formatDateTime(iso) {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  },

  genId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  },

  /* ─── PEDIDOS ─────────────────────────────────────────────── */
  getPedidos() {
    try {
      const raw = localStorage.getItem('lilop_admin_pedidos');
      if (raw) return JSON.parse(raw);
    } catch {}
    return this._defaultPedidos();
  },

  savePedidos(pedidos) {
    localStorage.setItem('lilop_admin_pedidos', JSON.stringify(pedidos));
  },

  addPedido(pedido) {
    const pedidos = this.getPedidos();
    const nuevo = { ...pedido, id: this.genId(), createdAt: new Date().toISOString() };
    pedidos.unshift(nuevo);
    this.savePedidos(pedidos);
    return nuevo;
  },

  updatePedido(id, data) {
    const pedidos = this.getPedidos();
    const idx = pedidos.findIndex(p => p.id === id);
    if (idx === -1) return null;
    pedidos[idx] = { ...pedidos[idx], ...data, updatedAt: new Date().toISOString() };
    this.savePedidos(pedidos);
    return pedidos[idx];
  },

  deletePedido(id) {
    const pedidos = this.getPedidos().filter(p => p.id !== id);
    this.savePedidos(pedidos);
  },

  /* ─── PRODUCTOS ───────────────────────────────────────────── */
  getProductos() {
    try {
      const raw = localStorage.getItem('lilop_admin_productos');
      if (raw) return JSON.parse(raw);
    } catch {}
    return this._defaultProductos();
  },

  saveProductos(productos) {
    localStorage.setItem('lilop_admin_productos', JSON.stringify(productos));
  },

  addProducto(producto) {
    const productos = this.getProductos();
    const nuevo = { ...producto, id: this.genId(), createdAt: new Date().toISOString() };
    productos.unshift(nuevo);
    this.saveProductos(productos);
    return nuevo;
  },

  updateProducto(id, data) {
    const productos = this.getProductos();
    const idx = productos.findIndex(p => p.id === id);
    if (idx === -1) return null;
    productos[idx] = { ...productos[idx], ...data, updatedAt: new Date().toISOString() };
    this.saveProductos(productos);
    return productos[idx];
  },

  deleteProducto(id) {
    const productos = this.getProductos().filter(p => p.id !== id);
    this.saveProductos(productos);
  },

  /* ─── CLIENTES ────────────────────────────────────────────── */
  getClientes() {
    try {
      const raw = localStorage.getItem('lilop_admin_clientes');
      if (raw) return JSON.parse(raw);
    } catch {}
    return this._defaultClientes();
  },

  saveClientes(clientes) {
    localStorage.setItem('lilop_admin_clientes', JSON.stringify(clientes));
  },

  addCliente(cliente) {
    const clientes = this.getClientes();
    const nuevo = { ...cliente, id: this.genId(), createdAt: new Date().toISOString() };
    clientes.unshift(nuevo);
    this.saveClientes(clientes);
    return nuevo;
  },

  updateCliente(id, data) {
    const clientes = this.getClientes();
    const idx = clientes.findIndex(c => c.id === id);
    if (idx === -1) return null;
    clientes[idx] = { ...clientes[idx], ...data };
    this.saveClientes(clientes);
    return clientes[idx];
  },

  deleteCliente(id) {
    const clientes = this.getClientes().filter(c => c.id !== id);
    this.saveClientes(clientes);
  },

  /* ─── ESTADÍSTICAS ────────────────────────────────────────── */
  getStats() {
    const pedidos   = this.getPedidos();
    const productos = this.getProductos();
    const clientes  = this.getClientes();

    const totalVentas = pedidos
      .filter(p => p.estado !== 'cancelado')
      .reduce((sum, p) => sum + (p.total || 0), 0);

    const pendientes    = pedidos.filter(p => p.estado === 'pendiente').length;
    const enProduccion  = pedidos.filter(p => p.estado === 'en_produccion').length;
    const enviados      = pedidos.filter(p => p.estado === 'enviado').length;
    const entregados    = pedidos.filter(p => p.estado === 'entregado').length;

    return {
      totalVentas,
      totalPedidos:   pedidos.length,
      totalClientes:  clientes.length,
      totalProductos: productos.length,
      pendientes,
      enProduccion,
      enviados,
      entregados,
    };
  },

  /* ─── DATOS POR DEFECTO (mock) ────────────────────────────── */
  _defaultPedidos() {
    const pedidos = [
      {
        id: 'ped-001',
        numero: 'ORD-2025-001',
        cliente: { nombre: 'María García', telefono: '3001234567', email: 'maria@gmail.com', ciudad: 'Bogotá' },
        items: [{ nombre: 'Juego Sábanas Premium Queen', cantidad: 1, precio: 189000 }],
        total: 189000,
        estado: 'entregado',
        metodoPago: 'mercadopago',
        notas: '',
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
      {
        id: 'ped-002',
        numero: 'ORD-2025-002',
        cliente: { nombre: 'Carlos Rondón', telefono: '3109876543', email: 'carlos@gmail.com', ciudad: 'Medellín' },
        items: [
          { nombre: 'Edredón Nórdico Queen', cantidad: 1, precio: 320000 },
          { nombre: 'Almohada Memory Foam', cantidad: 2, precio: 98000 }
        ],
        total: 516000,
        estado: 'enviado',
        metodoPago: 'transferencia',
        notas: 'Entregar en horario de tarde',
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
      {
        id: 'ped-003',
        numero: 'ORD-2025-003',
        cliente: { nombre: 'Laura Pedroza', telefono: '3156789012', email: 'laura@hotmail.com', ciudad: 'Cali' },
        items: [{ nombre: 'Juego Toallas Algodón Turco', cantidad: 1, precio: 175000 }],
        total: 175000,
        estado: 'en_produccion',
        metodoPago: 'whatsapp',
        notas: '',
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
      {
        id: 'ped-004',
        numero: 'ORD-2025-004',
        cliente: { nombre: 'Andrés Mora', telefono: '3204567890', email: 'andres@gmail.com', ciudad: 'Barranquilla' },
        items: [{ nombre: 'Sábanas Bambú Premium Queen', cantidad: 1, precio: 215000 }],
        total: 215000,
        estado: 'pendiente',
        metodoPago: 'mercadopago',
        notas: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ped-005',
        numero: 'ORD-2025-005',
        cliente: { nombre: 'Sofía Vargas', telefono: '3012345678', email: 'sofia@gmail.com', ciudad: 'Bucaramanga' },
        items: [{ nombre: 'Cubrecama Acolchado Queen', cantidad: 1, precio: 245000 }],
        total: 245000,
        estado: 'pendiente',
        metodoPago: 'whatsapp',
        notas: 'Cliente frecuente',
        createdAt: new Date().toISOString(),
      },
    ];
    this.savePedidos(pedidos);
    return pedidos;
  },

  _defaultProductos() {
    const productos = [
      { id: 'prod-001', nombre: 'Juego de Sábanas Premium Cotton', categoria: 'sabanas', precio: 189000, estado: 'active', stock: 'available', vendidos: 124, createdAt: new Date(Date.now() - 30 * 86400000).toISOString() },
      { id: 'prod-002', nombre: 'Edredón Nórdico Plumón Sintético', categoria: 'edredones', precio: 320000, estado: 'active', stock: 'available', vendidos: 78, createdAt: new Date(Date.now() - 25 * 86400000).toISOString() },
      { id: 'prod-003', nombre: 'Almohada Viscoelástica Memory Foam', categoria: 'almohadas', precio: 98000, estado: 'active', stock: 'available', vendidos: 203, createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
      { id: 'prod-004', nombre: 'Juego de Toallas Algodón Turco', categoria: 'toallas', precio: 175000, estado: 'active', stock: 'available', vendidos: 167, createdAt: new Date(Date.now() - 15 * 86400000).toISOString() },
      { id: 'prod-005', nombre: 'Sábanas Bambú Premium', categoria: 'sabanas', precio: 215000, estado: 'active', stock: 'available', vendidos: 38, createdAt: new Date(Date.now() - 10 * 86400000).toISOString() },
    ];
    this.saveProductos(productos);
    return productos;
  },

  _defaultClientes() {
    const clientes = [
      { id: 'cli-001', nombre: 'María García', telefono: '3001234567', email: 'maria@gmail.com', ciudad: 'Bogotá', totalPedidos: 3, totalGastado: 567000, createdAt: new Date(Date.now() - 60 * 86400000).toISOString() },
      { id: 'cli-002', nombre: 'Carlos Rondón', telefono: '3109876543', email: 'carlos@gmail.com', ciudad: 'Medellín', totalPedidos: 1, totalGastado: 516000, createdAt: new Date(Date.now() - 30 * 86400000).toISOString() },
      { id: 'cli-003', nombre: 'Laura Pedroza', telefono: '3156789012', email: 'laura@hotmail.com', ciudad: 'Cali', totalPedidos: 2, totalGastado: 350000, createdAt: new Date(Date.now() - 15 * 86400000).toISOString() },
      { id: 'cli-004', nombre: 'Andrés Mora', telefono: '3204567890', email: 'andres@gmail.com', ciudad: 'Barranquilla', totalPedidos: 1, totalGastado: 215000, createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
      { id: 'cli-005', nombre: 'Sofía Vargas', telefono: '3012345678', email: 'sofia@gmail.com', ciudad: 'Bucaramanga', totalPedidos: 1, totalGastado: 245000, createdAt: new Date().toISOString() },
    ];
    this.saveClientes(clientes);
    return clientes;
  },
};

window.AdminStore = AdminStore;
