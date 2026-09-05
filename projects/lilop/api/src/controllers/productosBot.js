const { listarProductosParaBot, obtenerProductoParaBot } = require('../services/productosBot');

// Controller delgado: sin lógica de negocio ni SQL, solo orquesta
// request -> service -> response. Endpoints públicos sin autenticación
// para el agente de IA (n8n). No tocan ningún controller/ruta existente.

async function listar(req, res) {
  try {
    const productos = await listarProductosParaBot();
    res.set('Cache-Control', 'public, max-age=60');
    res.json(productos);
  } catch (err) {
    console.error('Error listando productos para bot:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function obtener(req, res) {
  try {
    const producto = await obtenerProductoParaBot(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.set('Cache-Control', 'public, max-age=60');
    res.json(producto);
  } catch (err) {
    console.error('Error obteniendo producto para bot:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, obtener };
