const BaseService = require('../../core/BaseService');

/**
 * CatalogoService — reglas de negocio del catálogo. La transformación
 * de filas crudas de BD al shape que consume el sitio público
 * (lilop.store) vive aquí — es lógica de negocio real (cálculo de
 * precio mínimo, slug, etc.), no solo acceso a datos.
 */
class CatalogoService extends BaseService {
  listar() { return this.repos.catalogo.listar(); }
  crear(datos) { return this.repos.catalogo.crear(datos); }
  actualizar(id, datos) { return this.repos.catalogo.actualizar(id, datos); }
  toggleActivo(id) { return this.repos.catalogo.toggleActivo(id); }
  eliminar(id) { return this.repos.catalogo.eliminar(id); }
  upsertPrecio(catalogoId, datos) { return this.repos.catalogo.upsertPrecio(catalogoId, datos); }

  async listarPublico() {
    const rows = await this.repos.catalogo.listarPublicoRaw();
    return rows.map((c) => {
      const precios = c.precios || [];
      const precioMin = precios.length ? Math.min(...precios.map((p) => parseFloat(p.precio))) : 0;

      return {
        id: c.id,
        name: c.nombre,
        slug: c.nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        price: precioMin,
        originalPrice: c.precio_original ? parseFloat(c.precio_original) : null,
        category: (c.categorias || [])[0]?.slug || 'general',
        categoryLabel: (c.categorias || [])[0]?.nombre || c.nombre,
        categorias: c.categorias || [],
        attributes: (c.atributos || []).map((a) => ({ ...a, sobreprecio: parseFloat(a.sobreprecio) })),
        description: c.descripcion || '',
        shortDescription: c.descripcion_corta || '',
        materials: c.materiales || [],
        care: c.cuidados || [],
        variants: { Tamaño: precios.map((p) => p.tamanio) },
        precios: precios.map((p) => ({ tamanio: p.tamanio, precio: parseFloat(p.precio) })),
        images: (c.disenos || []).map((d) => `https://api.lilop.store${d.imagen}`),
        designNames: (c.disenos || []).map((d) => d.nombre),
        featured: c.featured,
        badge: c.badge || null,
        badgeType: c.badge_tipo || null,
        stock: 'available',
        rating: 0,
        reviewCount: 0,
        tags: c.tags || [],
      };
    });
  }
}

module.exports = CatalogoService;
