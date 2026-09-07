const express = require('express');
const cors    = require('cors');

const app = express();

// ── Middlewares globales ──────────────────────────────────
app.use(cors({
  origin:      process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', require('express').static('/app/uploads'));

// ── Health check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rutas ─────────────────────────────────────────────────
app.use('/api/auth',       require('./domains/auth/auth.routes'));
app.use('/api/usuarios',   require('./domains/usuarios/usuarios.routes'));
app.use('/api/maestros',   require('./domains/maestros/maestros.routes'));
app.use('/api/clientes',   require('./domains/clientes/clientes.routes'));
app.use('/api/pedidos',    require('./domains/pedidos/pedidos.routes'));

/* Catálogo de productos (nombres únicos) */
const { auth } = require('./middleware/auth');
const productosPedidoDominio = require('./domains/productos_pedido/productos_pedido.routes');
app.get('/api/productos/catalogo', auth, productosPedidoDominio.controller.catalogo);
app.use('/api/comisiones', require('./domains/comisiones/comisiones.routes'));
app.use('/api/catalogo',   require('./domains/catalogo/catalogo.routes').router);

/* Endpoints públicos sin autenticación */
app.get('/api/public/categorias', async (req, res) => {
  try {
    const pool = require('./config/db');
    const r = await pool.query(`SELECT id, nombre, slug FROM categorias c WHERE activo = true AND EXISTS (SELECT 1 FROM catalogo_productos_categorias cpc JOIN catalogo_productos cp ON cp.id = cpc.catalogo_id WHERE cpc.categoria_id = c.id AND cp.activo = true) ORDER BY nombre`);
    res.set('Cache-Control', 'public, max-age=60');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* Atributos: dominio con router (admin) y controller (para el público) */
const atributosDominio = require('./domains/atributos/atributos.routes');
app.get('/api/public/atributos/:catalogo_id', atributosDominio.controller.listarPorProducto);

/* Endpoint público sin autenticación */
const catalogoDominio = require('./domains/catalogo/catalogo.routes');
app.get('/api/public/productos', catalogoDominio.controller.listarPublico);

/* Endpoint público: crear pedido desde el checkout del sitio */
const { crearPedidoPublico } = require('./domains/pedidos_publicos/pedidos_publicos.routes');
app.post('/api/public/pedidos', crearPedidoPublico);

/* Endpoints públicos para el bot de IA (n8n): dominio productos en POO/SOLID
   (ver projects/lilop/docs/migracion-productos-variantes.md sección 8) */
app.use('/api/public/bot', require('./domains/productos/productos.routes'));
app.use('/api/demo',        require('./domains/demo/demo.routes'));
app.use('/api/disenos',    require('./domains/disenos/disenos.routes'));
app.use('/api/atributos',  atributosDominio.router);
app.use('/api/imagenes',   require('./domains/imagenes/imagenes.routes'));

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Error global ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Arranque ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API lilop corriendo en puerto ${PORT}`);
});
