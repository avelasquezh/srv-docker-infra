/* ============================================================
   Lilop Admin — colombia.js
   Datos estáticos de departamentos y municipios de Colombia.
   Incluye helper para poblar selects y manejar Bogotá.
   ============================================================ */

'use strict';

const COLOMBIA = {
  'Amazonas':          ['Leticia','Puerto Nariño'],
  'Antioquia':         ['Medellín','Bello','Itagüí','Envigado','Apartadó','Turbo','Rionegro','Caucasia','Sabaneta','La Estrella','Copacabana','Girardota','Barbosa','Donmatías','El Carmen de Viboral','Guarne','Marinilla','El Retiro','La Ceja','Caldas'],
  'Arauca':            ['Arauca','Arauquita','Fortul','Puerto Rondón','Saravena','Tame'],
  'Atlántico':         ['Barranquilla','Soledad','Malambo','Sabanalarga','Galapa','Puerto Colombia','Baranoa','Sabanagrande','Santo Tomás','Palmar de Varela'],
  'Bolívar':           ['Cartagena','Magangué','El Carmen de Bolívar','Turbaco','Arjona','Mompós','San Juan Nepomuceno','Achi','Calamar'],
  'Boyacá':            ['Tunja','Duitama','Sogamoso','Chiquinquirá','Paipa','Moniquirá','Garagoa','Aquitania','Puerto Boyacá','Samacá'],
  'Caldas':            ['Manizales','La Dorada','Chinchiná','Riosucio','Salamina','Villamaría','Aguadas','Anserma','Manzanares','Neira'],
  'Caquetá':           ['Florencia','San Vicente del Caguán','Puerto Rico','El Doncello','La Montañita','Belén de los Andaquíes','Cartagena del Chairá'],
  'Casanare':          ['Yopal','Aguazul','Villanueva','Paz de Ariporo','Tauramena','Monterrey','Sabanalarga','Trinidad','Nunchía'],
  'Cauca':             ['Popayán','Santander de Quilichao','Puerto Tejada','Patía','Guapi','Miranda','Bolívar','El Bordo','Piendamó'],
  'Cesar':             ['Valledupar','Aguachica','Bosconia','Codazzi','La Jagua de Ibirico','Curumaní','Pailitas','El Copey'],
  'Chocó':             ['Quibdó','Istmina','Tadó','Condoto','Riosucio','Bahía Solano','Nuquí'],
  'Córdoba':           ['Montería','Lorica','Cereté','Sahagún','Montelíbano','San Pelayo','Tierralta','Planeta Rica','Ciénaga de Oro'],
  'Cundinamarca':      ['Soacha','Zipaquirá','Fusagasugá','Facatativá','Chía','Mosquera','Madrid','Funza','Cajicá','Tocancipá','La Calera','Sibaté','Girardot','Villeta','Gachancipá'],
  'Bogotá D.C.':       ['Bogotá D.C.'],
  'Guainía':           ['Inírida'],
  'Guaviare':          ['San José del Guaviare','Calamar','El Retorno','Miraflores'],
  'Huila':             ['Neiva','Pitalito','Garzón','La Plata','Campoalegre','Palermo','Gigante','Timaná'],
  'La Guajira':        ['Riohacha','Maicao','Uribia','Manaure','Fonseca','Barrancas','San Juan del Cesar'],
  'Magdalena':         ['Santa Marta','Ciénaga','Fundación','Plato','El Banco','Aracataca','Pivijay'],
  'Meta':              ['Villavicencio','Acacías','Granada','Puerto López','San Martín','Cumaral','Restrepo','Lejanías'],
  'Nariño':            ['Pasto','Tumaco','Ipiales','Túquerres','La Unión','El Charco','Samaniego','Barbacoas'],
  'Norte de Santander':['Cúcuta','Ocaña','Pamplona','Villa del Rosario','Los Patios','El Zulia','Tibú','Sardinata'],
  'Putumayo':          ['Mocoa','Puerto Asís','Orito','Sibundoy','Valle del Guamuez','Puerto Leguízamo'],
  'Quindío':           ['Armenia','Calarcá','Montenegro','Quimbaya','La Tebaida','Circasia','Filandia','Buenavista'],
  'Risaralda':         ['Pereira','Dosquebradas','Santa Rosa de Cabal','La Virginia','Quinchía','Marsella','Belén de Umbría'],
  'San Andrés':        ['San Andrés','Providencia'],
  'Santander':         ['Bucaramanga','Floridablanca','Girón','Piedecuesta','Barrancabermeja','San Gil','Socorro','Málaga','Vélez','Lebrija'],
  'Sucre':             ['Sincelejo','Corozal','Sampués','San Marcos','Tolú','Ovejas','Morroa','San Onofre'],
  'Tolima':            ['Ibagué','Espinal','Melgar','Honda','Líbano','Mariquita','Girardot','Chaparral','Guamo'],
  'Valle del Cauca':   ['Cali','Buenaventura','Palmira','Tuluá','Buga','Cartago','Jamundí','Yumbo','Candelaria','Pradera','Florida','Sevilla','Roldanillo'],
  'Vaupés':            ['Mitú'],
  'Vichada':           ['Puerto Carreño','La Primavera','Santa Rosalía','Cumaribo'],
};

const LOCALIDADES_BOGOTA = [
  'Usaquén','Chapinero','Santa Fe','San Cristóbal','Usme','Tunjuelito',
  'Bosa','Kennedy','Fontibón','Engativá','Suba','Barrios Unidos',
  'Teusaquillo','Los Mártires','Antonio Nariño','Puente Aranda',
  'La Candelaria','Rafael Uribe Uribe','Ciudad Bolívar','Sumapaz',
];

/* ── Helper: poblar select de departamentos ── */
function poblarDepartamentos(selectId, valorActual = '') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar departamento...</option>' +
    Object.keys(COLOMBIA)
      .sort()
      .map(dep => `<option value="${dep}" ${dep === valorActual ? 'selected' : ''}>${dep}</option>`)
      .join('');
}

/* ── Helper: poblar select de municipios según departamento ── */
function poblarMunicipios(deptoSelectId, munSelectId, valorActual = '') {
  const deptoSel = document.getElementById(deptoSelectId);
  const munSel   = document.getElementById(munSelectId);
  if (!deptoSel || !munSel) return;

  const depto = deptoSel.value;
  const municipios = COLOMBIA[depto] || [];

  munSel.innerHTML = '<option value="">Seleccionar ciudad...</option>' +
    municipios
      .sort()
      .map(m => `<option value="${m}" ${m === valorActual ? 'selected' : ''}>${m}</option>`)
      .join('');

  munSel.disabled = !depto;
}

/* ── Helper: manejar campo localidad según ciudad ── */
function actualizarLocalidad(munSelectId, localidadWrapperId, localidadSelectId, localidadInputId, valorActual = '') {
  const munSel       = document.getElementById(munSelectId);
  const wrapper      = document.getElementById(localidadWrapperId);
  const localSel     = document.getElementById(localidadSelectId);
  const localInput   = document.getElementById(localidadInputId);
  if (!munSel || !wrapper) return;

  const ciudad = munSel.value;
  const esBogota = ciudad === 'Bogotá D.C.';

  wrapper.style.display = ciudad ? 'flex' : 'none';

  if (esBogota) {
    if (localSel)   localSel.style.display   = 'block';
    if (localInput) localInput.style.display = 'none';
    if (localSel) {
      localSel.innerHTML = '<option value="">Seleccionar localidad...</option>' +
        LOCALIDADES_BOGOTA.map(l =>
          `<option value="${l}" ${l === valorActual ? 'selected' : ''}>${l}</option>`
        ).join('');
    }
  } else {
    if (localSel)   localSel.style.display   = 'none';
    if (localInput) {
      localInput.style.display = 'block';
      if (valorActual && !esBogota) localInput.value = valorActual;
    }
  }
}

/* ── Render formulario de cliente ── */
function renderFormCliente(c = null) {
  return `
    <div class="modal-section">
      <p class="modal-section__title">Datos personales</p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label form-label--required">Nombre completo</label>
          <input class="form-input" id="cNombre" value="${c?.nombre || ''}" placeholder="Nombre y apellido"/>
        </div>
        <div class="form-group">
          <label class="form-label form-label--required">Celular</label>
          <input class="form-input" id="cCelular" type="tel" autocomplete="off" value="${c?.celular || ''}"
            placeholder="300 000 0000" maxlength="10"
            pattern="^(30|31|32|35|60)[0-9]{8}$"/>
          <span style="font-size:var(--text-xs);color:var(--color-text-light);">Debe comenzar por 30, 31, 32, 35 o 60</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Origen de venta</label>
        <select class="form-input" id="cOrigen">
          <option value="">Selecciona origen…</option>
        </select>
      </div>
    </div>

    <div class="modal-section">
      <p class="modal-section__title">Dirección</p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label form-label--required">Departamento</label>
          <select class="form-input" id="cDepartamento" onchange="
            poblarMunicipios('cDepartamento','cCiudad');
            actualizarLocalidad('cCiudad','cLocalidadWrap','cLocalidadSel','cLocalidadInput');
          ">
            <option value="">Seleccionar departamento...</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--required">Ciudad / Municipio</label>
          <select class="form-input" id="cCiudad" disabled onchange="
            actualizarLocalidad('cCiudad','cLocalidadWrap','cLocalidadSel','cLocalidadInput','${c?.localidad || ''}');
          ">
            <option value="">Seleccionar ciudad...</option>
          </select>
        </div>
      </div>

      <div class="form-group" id="cLocalidadWrap" style="display:none;">
        <label class="form-label form-label--required">Localidad</label>
        <select class="form-input" id="cLocalidadSel" style="display:none;">
          <option value="">Seleccionar localidad...</option>
        </select>
        <input class="form-input" id="cLocalidadInput" style="display:none;"
          placeholder="Localidad o sector" value="${c?.localidad || ''}"/>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label form-label--required">Barrio</label>
          <input class="form-input" id="cBarrio" value="${c?.barrio || ''}" placeholder="Nombre del barrio"/>
        </div>
        <div class="form-group">
          <label class="form-label form-label--required">Dirección</label>
          <input class="form-input" id="cDireccion" value="${c?.direccion || ''}" placeholder="Calle 00 # 00-00"/>
        </div>
      </div>
    </div>
  `;
}

/* ── Inicializar form tras inyectarlo en el DOM ── */
function initFormCliente(c = null) {
  poblarDepartamentos('cDepartamento', c?.departamento || '');

  if (c?.departamento) {
    poblarMunicipios('cDepartamento', 'cCiudad', c?.ciudad || '');
    const munSel = document.getElementById('cCiudad');
    if (munSel) munSel.disabled = false;
    if (c?.ciudad) {
      actualizarLocalidad('cCiudad', 'cLocalidadWrap', 'cLocalidadSel', 'cLocalidadInput', c?.localidad || '');
    }
  }
}

/* ── Recolectar datos del form ── */
function recolectarFormCliente() {
  const nombre   = document.getElementById('cNombre')?.value.trim();
  const celular  = document.getElementById('cCelular')?.value.trim().replace(/\s/g, '');
  const depto    = document.getElementById('cDepartamento')?.value;
  const ciudad   = document.getElementById('cCiudad')?.value;
  const esBogota = ciudad === 'Bogotá D.C.';
  const localidad = esBogota
    ? document.getElementById('cLocalidadSel')?.value
    : document.getElementById('cLocalidadInput')?.value.trim();

  return {
    nombre,
    celular,
    departamento: depto   || null,
    ciudad:       ciudad  || null,
    localidad:    localidad || null,
    barrio:       document.getElementById('cBarrio')?.value.trim()    || null,
    direccion:    document.getElementById('cDireccion')?.value.trim() || null,
    origen_venta: document.getElementById('cOrigen')?.value.trim()    || null,
  };
}

/* ── Validar form ── */
function validarFormCliente() {
  const nombre  = document.getElementById('cNombre')?.value.trim();
  const celular = document.getElementById('cCelular')?.value.trim().replace(/\s/g, '');
  const depto   = document.getElementById('cDepartamento')?.value;
  const ciudad  = document.getElementById('cCiudad')?.value;

  if (!nombre) {
    window.AdminToast?.error('Campo requerido', 'El nombre es obligatorio');
    return false;
  }
  if (!celular) {
    window.AdminToast?.error('Campo requerido', 'El celular es obligatorio');
    return false;
  }
  if (!/^(30|31|32|35|60)\d{8}$/.test(celular)) {
    window.AdminToast?.error('Celular inválido', 'Debe tener 10 dígitos y comenzar por 30, 31, 32, 35 o 60');
    return false;
  }
  if (!depto) {
    window.AdminToast?.error('Campo requerido', 'Selecciona un departamento');
    return false;
  }
  if (!ciudad) {
    window.AdminToast?.error('Campo requerido', 'Selecciona una ciudad');
    return false;
  }
  const esBogota  = ciudad === 'Bogotá D.C.';
  const localidad = esBogota
    ? document.getElementById('cLocalidadSel')?.value
    : document.getElementById('cLocalidadInput')?.value.trim();
  if (!localidad) {
    window.AdminToast?.error('Campo requerido', 'La localidad es obligatoria');
    return false;
  }
  if (!document.getElementById('cBarrio')?.value.trim()) {
    window.AdminToast?.error('Campo requerido', 'El barrio es obligatorio');
    return false;
  }
  if (!document.getElementById('cDireccion')?.value.trim()) {
    window.AdminToast?.error('Campo requerido', 'La dirección es obligatoria');
    return false;
  }
  return true;
}

/* Exportar helpers al scope global */
window.COLOMBIA             = COLOMBIA;
window.LOCALIDADES_BOGOTA   = LOCALIDADES_BOGOTA;
window.poblarDepartamentos  = poblarDepartamentos;
window.poblarMunicipios     = poblarMunicipios;
window.actualizarLocalidad  = actualizarLocalidad;
window.renderFormCliente    = renderFormCliente;
window.poblarOrigenes = function(origenes, valorActual) {
  const sel = document.getElementById('cOrigen');
  if (!sel) return;
  sel.innerHTML = '<option value="" disabled selected>Selecciona origen…</option>' +
    origenes.map(o => `<option value="${o}" ${o === valorActual ? 'selected' : ''}>${o}</option>`).join('');
};
window.initFormCliente      = initFormCliente;
window.recolectarFormCliente = recolectarFormCliente;
window.validarFormCliente   = validarFormCliente;