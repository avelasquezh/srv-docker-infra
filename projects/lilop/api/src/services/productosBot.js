const repo = require('../repositories/productosBot');

// Capa de servicio: aplica el "contrato de respuesta del bot" (ver
// projects/lilop/docs/migracion-productos-variantes.md sección 7bis).
// El controller no arma JSON a mano; solo llama aquí.

function formatearProducto(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion_corta || null,
    variables: (row.variables || []).map(v => ({
      nombre: v.nombre,
      tipo: v.tipo,               // 'lista' | 'booleano'
      valores: v.valores || null, // null cuando es booleano
    })),
    variantes: (row.variantes || []).map(vt => ({
      id: vt.id,
      atributos: vt.atributos || {},
      precio: Number(vt.precio),
      disponible: vt.stock > 0,
    })),
  };
}

async function listarProductosParaBot() {
  const rows = await repo.listarProductosConVariantes();
  return rows.map(formatearProducto);
}

async function obtenerProductoParaBot(catalogoId) {
  const row = await repo.obtenerProductoConVariantes(catalogoId);
  return row ? formatearProducto(row) : null;
}

module.exports = { listarProductosParaBot, obtenerProductoParaBot };
