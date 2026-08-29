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
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/usuarios',   require('./routes/usuarios'));
app.use('/api/maestros',   require('./routes/maestros'));
app.use('/api/clientes',   require('./routes/clientes'));
app.use('/api/pedidos',    require('./routes/pedidos'));

/* Catálogo de productos (nombres únicos) */
const { auth } = require('./middleware/auth');
const { catalogo } = require('./controllers/productos');
app.get('/api/productos/catalogo', auth, catalogo);
app.use('/api/comisiones', require('./routes/comisiones'));
app.use('/api/catalogo',   require('./routes/catalogo'));

/* Endpoints públicos sin autenticación */
const { listarCategorias } = require('./controllers/maestros');
app.get('/api/public/categorias', async (req, res) => {
  try {
    const pool = require('./config/db');
    const r = await pool.query('SELECT id, nombre, slug FROM categorias WHERE activo = true ORDER BY nombre');
    res.set('Cache-Control', 'public, max-age=60');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* Atributos públicos por producto */
const { listarPorProducto } = require('./controllers/atributos');
app.get('/api/public/atributos/:catalogo_id', listarPorProducto);

/* Endpoint público sin autenticación */
const { listarPublico } = require('./controllers/catalogo');
app.get('/api/public/productos', listarPublico);
app.use('/api/demo',        require('./routes/demo'));
app.use('/api/disenos',    require('./routes/disenos'));
app.use('/api/atributos',  require('./routes/atributos'));
app.use('/api/imagenes',   require('./routes/imagenes'));

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
