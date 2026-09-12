const BaseRepository = require('../../core/BaseRepository');

// El check constraint viejo permitía 'booleano'|'seleccion'; el enum nuevo
// (tipo_variable) es 'booleano'|'lista'. 'seleccion' -> 'lista'. Hoy no hay
// ninguna fila real de tipo 'seleccion' (confirmado antes de escribir esto,
// ver sección 7quinquies del MD), se deja el mapeo por si aparece alguna.
const MAPA_TIPO_ENTRADA = { booleano: 'booleano', seleccion: 'lista' };
const MAPA_TIPO_SALIDA = { booleano: 'booleano', lista: 'seleccion' };

/**
 * Repuntado al esquema nuevo (variables/variable_valores/producto_variables)
 * — Fase 6, plan de la sección 7quinquies. Mismo contrato HTTP hacia el
 * admin (misma forma de fila: {id, nombre, tipo, sobreprecio, activo,
 * opciones: [{id,nombre,valor}]}), para que AtributoService/Controller no
 * necesiten cambiar.
 *
 * IMPORTANTE — hallazgo real al hacer este repunte: `producto_variables`
 * en el esquema nuevo guarda EN LA MISMA TABLA tanto la asignación de
 * "Tamaño" (el precio/talla del producto) como estos atributos booleanos
 * (Plumón/Piel de conejo). Por eso TODAS las queries de este archivo
 * excluyen explícitamente la variable "Tamaño" — si no se excluyera,
 * `reemplazarAtributosProducto()` borraría también la configuración de
 * tamaño del producto cada vez que se edita un atributo, y `listar()`
 * mostraría "Tamaño" como si fuera un atributo togglable más. El admin de
 * precios (`domains/catalogo/`) es dueño exclusivo de la fila "Tamaño";
 * este dominio nunca debe tocarla.
 */
class AtributoRepository extends BaseRepository {
  async listar() {
    const { rows } = await this.query(`
      SELECT var.*,
        json_agg(json_build_object('id', vv.id, 'nombre', vv.valor, 'valor', vv.valor) ORDER BY vv.id)
        FILTER (WHERE vv.id IS NOT NULL) AS opciones
      FROM variables var
      LEFT JOIN variable_valores vv ON vv.variable_id = var.id
      WHERE var.nombre <> 'Tamaño'
      GROUP BY var.id ORDER BY var.nombre
    `);
    return rows.map((r) => this._traducirTipoSalida(r));
  }

  async crear({ nombre, tipo, sobreprecio }) {
    const tipoNuevo = MAPA_TIPO_ENTRADA[tipo] || tipo;
    const { rows } = await this.query(
      'INSERT INTO variables (nombre, tipo, sobreprecio) VALUES ($1, $2, $3) RETURNING *',
      [nombre, tipoNuevo, sobreprecio]
    );
    return this._traducirTipoSalida(rows[0]);
  }

  async actualizar(id, { nombre, sobreprecio, activo }) {
    const { rows } = await this.query(
      `UPDATE variables SET nombre = COALESCE($1, nombre), sobreprecio = COALESCE($2, sobreprecio), activo = COALESCE($3, activo)
       WHERE id = $4 AND nombre <> 'Tamaño' RETURNING *`,
      [nombre, sobreprecio, activo, id]
    );
    return rows[0] ? this._traducirTipoSalida(rows[0]) : null;
  }

  async eliminar(id) {
    await this.query(`DELETE FROM variables WHERE id = $1 AND nombre <> 'Tamaño'`, [id]);
  }

  async crearOpcion(atributoId, { valor }) {
    // Nota de fidelidad: atributo_opciones tenía nombre/valor como columnas
    // separadas; variable_valores solo tiene valor. Se usa el mismo texto
    // para ambos campos de salida (ver migración 011, mismo criterio). Sin
    // impacto real hoy: 0 filas de opciones en producción al momento del
    // repunte.
    const { rows } = await this.query(
      'INSERT INTO variable_valores (variable_id, valor) VALUES ($1, $2) RETURNING *',
      [atributoId, valor]
    );
    return { id: rows[0].id, atributo_id: rows[0].variable_id, nombre: rows[0].valor, valor: rows[0].valor };
  }

  async eliminarOpcion(opcionId) {
    await this.query('DELETE FROM variable_valores WHERE id = $1', [opcionId]);
  }

  async listarPorProducto(catalogoId) {
    const { rows } = await this.query(
      `SELECT var.*,
         json_agg(json_build_object('id', vv.id, 'nombre', vv.valor, 'valor', vv.valor) ORDER BY vv.id)
         FILTER (WHERE vv.id IS NOT NULL) AS opciones
       FROM variables var
       JOIN producto_variables pv ON pv.variable_id = var.id
       LEFT JOIN variable_valores vv ON vv.variable_id = var.id
       WHERE pv.producto_id = $1 AND var.nombre <> 'Tamaño'
       GROUP BY var.id ORDER BY var.nombre`,
      [catalogoId]
    );
    return rows.map((r) => this._traducirTipoSalida(r));
  }

  async reemplazarAtributosProducto(catalogoId, atributoIds) {
    // Scoped a variables != Tamaño — ver nota de la clase. Nunca toca la
    // fila de Tamaño de ese producto (posee/gestiona domains/catalogo).
    await this.query(
      `DELETE FROM producto_variables
       WHERE producto_id = $1
         AND variable_id IN (SELECT id FROM variables WHERE nombre <> 'Tamaño')`,
      [catalogoId]
    );
    if (atributoIds.length) {
      const vals = atributoIds.map((_, i) => `($1, $${i + 2}, NULL)`).join(',');
      await this.query(
        `INSERT INTO producto_variables (producto_id, variable_id, valores_permitidos) VALUES ${vals}`,
        [catalogoId, ...atributoIds]
      );
    }
  }

  _traducirTipoSalida(row) {
    return { ...row, tipo: MAPA_TIPO_SALIDA[row.tipo] || row.tipo };
  }
}

module.exports = AtributoRepository;
