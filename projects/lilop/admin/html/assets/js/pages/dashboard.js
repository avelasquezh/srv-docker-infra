/* ============================================================
   Lilop Admin — pages/dashboard.js  v4
   ============================================================ */
'use strict';

const session = window.AdminAuth.guard();
if (!session) throw new Error('No auth');

/* ── Helpers ─────────────────────────────────────────────── */
const fmt = v => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0);

const fmtShort = v => {
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return '$' + (v / 1_000).toFixed(0) + 'K';
  return fmt(v);
};

/* Retorna pedidos de un mes relativo al actual (0=este mes, -1=anterior) */
function getPedidosMes(pedidos, offset = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const fecha = new Date(y, m, 1);
  return pedidos.filter(p => {
    if (!p.fecha_venta) return false;
    const d = new Date(p.fecha_venta);
    return d.getFullYear() === fecha.getFullYear() && d.getMonth() === fecha.getMonth();
  });
}

/* Calcula variación porcentual */
function variacion(actual, anterior) {
  if (!anterior) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

/* Badge de variación */
function badgeVar(pct) {
  if (pct === null) return { text: 'Sin hist.', type: 'flat' };
  if (pct > 0)  return { text: `+${pct}% vs mes ant.`, type: 'up' };
  if (pct < 0)  return { text: `${pct}% vs mes ant.`, type: 'down' };
  return { text: 'Igual que mes ant.', type: 'flat' };
}

const ESTADOS = {
  por_confirmar:   { label: 'Por confirmar',   cls: 'status-badge--pending'    },
  en_alistamiento: { label: 'En alistamiento', cls: 'status-badge--processing' },
  por_entregar:    { label: 'Por entregar',    cls: 'status-badge--shipped'    },
  entregado:       { label: 'Entregado',       cls: 'status-badge--delivered'  },
  cancelado:       { label: 'Cancelado',       cls: 'status-badge--cancelled'  },
};

/* ── Skeletons ───────────────────────────────────────────── */
function skeletonRows(n, cols) {
  return Array(n).fill(
    `<tr>${Array(cols).fill(
      `<td><div style="height:14px;background:var(--color-fog);border-radius:4px;opacity:.6;"></div></td>`
    ).join('')}</tr>`
  ).join('');
}

function showLoadingStates() {
  document.getElementById('statCards').innerHTML = Array(9).fill(`
    <div class="stat-card" style="opacity:.5;">
      <div class="mb-4" style="height:38px;background:var(--color-fog);border-radius:var(--r-base)"></div>
      <div class="mb-2" style="height:26px;background:var(--color-fog);border-radius:var(--r-base);width:55%"></div>
      <div style="height:13px;background:var(--color-fog);border-radius:var(--r-base);width:75%;"></div>
    </div>`).join('');
  document.getElementById('recentOrdersBody').innerHTML    = skeletonRows(4, 4);
  document.getElementById('recentClientsBody').innerHTML   = skeletonRows(3, 4);
  document.getElementById('cuentasPorCobrarBody').innerHTML = skeletonRows(3, 4);
}

/* ── Stat Cards (9 KPIs con variación) ──────────────────── */
function renderStatCards(pedidos, todosLosPedidos) {
  todosLosPedidos = todosLosPedidos || pedidos;
  const activos   = pedidos.filter(p => !['entregado','cancelado'].includes(p.estado));
  const porConf   = pedidos.filter(p => p.estado === 'por_confirmar').length;

  /* Este mes */
  const mes       = pedidos.filter(p => p.estado !== 'cancelado');
  const mesCan    = pedidos.filter(p => p.estado === 'cancelado');
  const mesTotal  = pedidos;

  /* Mes anterior */
  const mesAnt    = getPedidosMes(todosLosPedidos, -1).filter(p => p.estado !== 'cancelado');
  const mesAntCan = getPedidosMes(todosLosPedidos, -1).filter(p => p.estado === 'cancelado');
  const mesAntTot = getPedidosMes(todosLosPedidos, -1);

  /* KPIs este mes */
  const ventas    = mes.filter(p => p.estado === 'entregado').reduce((s, p) => s + (+p.valor_venta || 0), 0);
  const ganancias = mes.filter(p => p.estado === 'entregado').reduce((s, p) => s + (+p.ganancias || 0), 0);
  const margen    = ventas > 0 ? Math.round((ganancias / ventas) * 100) : 0;
  const ticket    = mes.length ? ventas / mes.length : 0;
  const tasaCan   = mesTotal.length > 0 ? Math.round((mesCan.length / mesTotal.length) * 100) : 0;

  /* KPIs mes anterior */
  const ventasAnt    = mesAnt.filter(p => p.estado === 'entregado').reduce((s, p) => s + (+p.valor_venta || 0), 0);
  const gananciasAnt = mesAnt.filter(p => p.estado === 'entregado').reduce((s, p) => s + (+p.ganancias || 0), 0);
  const ticketAnt    = mesAnt.length ? ventasAnt / mesAnt.length : 0;
  const tasaCanAnt   = mesAntTot.length > 0 ? Math.round((mesAntCan.length / mesAntTot.length) * 100) : 0;

  /* Proyección del mes (días transcurridos vs días totales) */
  const hoy        = new Date();
  const diasMes    = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diasPasados = hoy.getDate();
  const proyeccion  = diasPasados > 0 ? Math.round((ventas / diasPasados) * diasMes) : 0;

  /* Ciclo promedio */
  const entregados = pedidos.filter(p =>
    p.estado === 'entregado' && p.fecha_venta && p.fecha_entrega
  );
  const ciclo = entregados.length
    ? Math.round(entregados.reduce((s, p) => {
        const d = (new Date(p.fecha_entrega) - new Date(p.fecha_venta)) / 86400000;
        return s + (d > 0 ? d : 0);
      }, 0) / entregados.length)
    : null;

  /* Comisiones y domicilios */
  const comisionPend = activos.reduce((s, p) => s + (+p.comision || 0), 0);
  const domPend      = pedidos.filter(p => p.estado === 'por_entregar' && +p.valor_domicilio > 0);
  const domTotal     = domPend.reduce((s, p) => s + (+p.valor_domicilio || 0), 0);

  /* Cuentas por cobrar */
  const cxc = pedidos.filter(p => p.estado === 'entregado' && p.medio_pago === 'Por confirmar');
  const cxcTotal = cxc.reduce((s, p) => s + (+p.valor_venta || 0), 0);

  /* Variaciones */
  const vVentas    = badgeVar(variacion(ventas,    ventasAnt));
  const vGanancias = badgeVar(variacion(ganancias, gananciasAnt));
  const vTicket    = badgeVar(variacion(ticket,    ticketAnt));
  const vPedidos   = badgeVar(variacion(mes.length, mesAnt.length));
  const vCan       = variacion(tasaCan, tasaCanAnt);
  const vBadgeCan  = vCan === null ? { text: 'Sin hist.', type: 'flat' }
                   : vCan > 0  ? { text: `+${vCan}% vs mes ant.`, type: 'down' }
                   : vCan < 0  ? { text: `${vCan}% vs mes ant.`, type: 'up' }
                   : { text: 'Igual que mes ant.', type: 'flat' };

  const trendIcon = {
    up:   '<polyline points="18 15 12 9 6 15"/>',
    down: '<polyline points="6 9 12 15 18 9"/>',
    flat: '<line x1="5" y1="12" x2="19" y2="12"/>',
  };

  const cards = [
    {
      label: 'Ingresos del mes',
      value: fmtShort(ventas),
      sub:   `Proyección: ${fmtShort(proyeccion)}`,
      icon:  'M12 2a10 10 0 100 20A10 10 0 0012 2zm1 14.93V18a1 1 0 11-2 0v-1.07A7.002 7.002 0 015.07 11H4a1 1 0 110-2h1.07A7.002 7.002 0 0111 5.07V4a1 1 0 112 0v1.07A7.002 7.002 0 0118.93 11H20a1 1 0 110 2h-1.07A7.002 7.002 0 0113 16.93z',
      iconClass: 'stat-card__icon--violet',
      trend: vVentas.text, trendType: vVentas.type,
    },
    {
      label: 'Ganancias del mes',
      value: fmtShort(ganancias),
      sub:   `Margen neto ${margen}%`,
      icon:  'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      iconClass: 'stat-card__icon--green',
      trend: vGanancias.text, trendType: vGanancias.type,
    },
    {
      label: 'Pedidos activos',
      value: activos.length,
      sub:   `${porConf} por confirmar`,
      icon:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      iconClass: 'stat-card__icon--blue',
      trend: vPedidos.text, trendType: vPedidos.type,
    },
    {
      label: 'Ticket promedio',
      value: fmtShort(ticket),
      sub:   `${mes.length} órdenes este mes`,
      icon:  'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
      iconClass: 'stat-card__icon--orange',
      trend: vTicket.text, trendType: vTicket.type,
    },
    {
      label: 'Comisiones por pagar',
      value: fmtShort(comisionPend),
      sub:   `En ${activos.length} pedido${activos.length !== 1 ? 's' : ''} activo${activos.length !== 1 ? 's' : ''}`,
      icon:  'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      iconClass: comisionPend > 0 ? 'stat-card__icon--orange' : 'stat-card__icon--green',
      trend: comisionPend > 0 ? 'Por liquidar' : 'Al día', trendType: comisionPend > 0 ? 'down' : 'flat',
    },
    {
      label: 'Tasa de cancelación',
      value: `${tasaCan}%`,
      sub:   `${mesCan.length} cancelado${mesCan.length !== 1 ? 's' : ''} este mes`,
      icon:  'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
      iconClass: tasaCan > 10 ? 'stat-card__icon--orange' : 'stat-card__icon--green',
      trend: vBadgeCan.text, trendType: vBadgeCan.type,
    },
    {
      label: 'Ciclo promedio',
      value: ciclo !== null ? `${ciclo} días` : '—',
      sub:   'Desde venta hasta entrega',
      icon:  'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      iconClass: ciclo !== null && ciclo <= 7 ? 'stat-card__icon--green' : 'stat-card__icon--blue',
      trend: entregados.length > 0 ? `${entregados.length} entregados` : 'Sin datos',
      trendType: ciclo !== null && ciclo <= 7 ? 'up' : 'flat',
    },
    {
      label: 'Domicilios por pagar',
      value: fmtShort(domTotal),
      sub:   `${domPend.length} envío${domPend.length !== 1 ? 's' : ''} por entregar`,
      icon:  'M8 17l4 4 4-4m-4-5v9M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29',
      iconClass: domTotal > 0 ? 'stat-card__icon--blue' : 'stat-card__icon--green',
      trend: domTotal > 0 ? 'Pendiente' : 'Sin pendientes', trendType: domTotal > 0 ? 'down' : 'flat',
    },
    {
      label: 'Cuentas por cobrar',
      value: fmtShort(cxcTotal),
      sub:   `${cxc.length} pedido${cxc.length !== 1 ? 's' : ''} entregado${cxc.length !== 1 ? 's' : ''} sin pago`,
      icon:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      iconClass: cxc.length > 0 ? 'stat-card__icon--orange' : 'stat-card__icon--green',
      trend: cxc.length > 0 ? `${cxc.length} por confirmar` : 'Todo cobrado',
      trendType: cxc.length > 0 ? 'down' : 'flat',
    },
  ];

  document.getElementById('statCards').innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-card__header">
        <div class="stat-card__icon ${c.iconClass}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="${c.icon}"/>
          </svg>
        </div>
        <span class="stat-card__trend stat-card__trend--${c.trendType}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" aria-hidden="true">${trendIcon[c.trendType]}</svg>
          ${c.trend}
        </span>
      </div>
      <div>
        <div class="stat-card__value">${c.value}</div>
        <div class="stat-card__label">${c.label}</div>
        <div class="stat-card__sub">${c.sub}</div>
      </div>
    </div>`).join('');
}

/* ── Gráfica ─────────────────────────────────────────────── */
let salesChartInstance = null;

function buildChartData(pedidos, days) {
  const activos = pedidos.filter(p => p.estado !== 'cancelado');
  const labels = [], dataVentas = [], dataGanancias = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    labels.push(d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    const day = activos.filter(p => (p.fecha_venta || '').startsWith(ds));
    dataVentas.push(day.reduce((s, p) => s + (+p.valor_venta || 0), 0));
    dataGanancias.push(day.reduce((s, p) => s + (+p.ganancias || 0), 0));
  }
  return { labels, dataVentas, dataGanancias };
}

function renderChart(pedidos, days = 7) {
  const ctx = document.getElementById('salesChart');
  if (!ctx) return;
  const { labels, dataVentas, dataGanancias } = buildChartData(pedidos, days);
  if (salesChartInstance) salesChartInstance.destroy();
  salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ventas', data: dataVentas,
          borderColor: '#6c3fc4', backgroundColor: 'rgba(108,63,196,0.08)',
          borderWidth: 2.5, pointBackgroundColor: '#6c3fc4',
          pointRadius: 4, pointHoverRadius: 6, fill: true, tension: 0.4,
        },
        {
          label: 'Ganancias', data: dataGanancias,
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.06)',
          borderWidth: 2, pointBackgroundColor: '#22c55e',
          pointRadius: 3, pointHoverRadius: 5, fill: true, tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true, position: 'top',
          labels: { font: { family: 'Outfit', size: 12 }, color: '#9080b0', boxWidth: 12 },
        },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.parsed.y)}` } },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(196,176,245,0.15)' },
          ticks: { callback: v => fmtShort(v), font: { family: 'Outfit', size: 11 }, color: '#9080b0' },
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Outfit', size: 11 }, color: '#9080b0' },
        },
      },
    },
  });
}

/* ── Pedidos recientes ───────────────────────────────────── */
function renderRecentOrders(pedidos) {
  const tbody = document.getElementById('recentOrdersBody');
  if (!tbody) return;
  const recent = [...pedidos]
    .sort((a, b) => new Date(b.fecha_venta) - new Date(a.fecha_venta))
    .slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td class="text-center text-muted" colspan="4" style="padding:32px">Sin pedidos aún</td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(p => {
    const est   = ESTADOS[p.estado] || { label: p.estado, cls: '' };
    const fecha = p.fecha_venta
      ? new Date(p.fecha_venta).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
      : '—';
    return `
      <tr class="cursor-pointer" onclick="window.location.href='pedidos.html?id=${p.id}'">
        <td>
          <span class="font-semibold text-ink text-sm">${p.id}</span><br/>
          <span class="text-xs text-muted">${fecha}</span>
        </td>
        <td class="text-sm"><a class="text-ink" href="/cliente.html?id=${p.cliente_id || ''}" style="text-decoration:none" onmouseover="this.style.color='var(--color-violet)'" onmouseout="this.style.color='var(--color-text)'">${p.cliente || '—'}</a></td>
        <td class="font-semibold text-violet">${fmt(p.valor_venta)}</td>
        <td><span class="status-badge ${est.cls}">${est.label}</span></td>
      </tr>`;
  }).join('');
}

/* ── Ventas por medio de pago ────────────────────────────── */
function renderMedioPago(pedidos) {
  const panel = document.getElementById('topProductsPanel');
  if (!panel) return;
  const byMedio = {};
  pedidos.filter(p => p.estado !== 'cancelado').forEach(p => {
    const m = p.medio_pago || 'Sin definir';
    if (!byMedio[m]) byMedio[m] = { count: 0, total: 0 };
    byMedio[m].count++;
    byMedio[m].total += (+p.valor_venta || 0);
  });
  const sorted = Object.entries(byMedio).sort((a, b) => b[1].total - a[1].total);
  const max = sorted[0]?.[1].total || 1;
  if (!sorted.length) {
    panel.innerHTML = `<p class="p-5 text-muted text-center">Sin datos</p>`;
    return;
  }
  panel.innerHTML = `
    <div class="p-5-6 d-flex flex-col gap-4">
      ${sorted.map(([medio, d], i) => `
        <div class="d-flex items-center gap-3">
          <span class="text-xs font-bold text-light" style="width:20px;text-align:right">${i + 1}</span>
          <div class="flex-1 min-w-0">
            <div class="d-flex justify-between" style="margin-bottom:4px">
              <p class="text-sm font-semibold text-ink">${medio}</p>
              <span class="text-xs text-muted">${d.count} pedido${d.count !== 1 ? 's' : ''}</span>
            </div>
            <div class="radius-pill" style="height:6px;background:var(--color-fog);overflow:hidden">
              <div class="radius-pill" style="height:100%;width:${Math.round((d.total / max) * 100)}%;background:var(--grad-primary);transition:width .8s"></div>
            </div>
          </div>
          <span class="text-sm font-semibold text-violet shrink-0" style="min-width:58px;text-align:right">${fmtShort(d.total)}</span>
        </div>`).join('')}
    </div>`;
}

/* ── Embudo de estados ───────────────────────────────────── */
function renderOrdersFunnel(pedidos) {
  const panel = document.getElementById('ordersFunnelPanel');
  if (!panel) return;
  const counts = {};
  pedidos.forEach(p => { counts[p.estado] = (counts[p.estado] || 0) + 1; });
  const items = [
    { key: 'por_confirmar',   label: 'Por confirmar',   color: '#f59e0b', bg: '#fef3c7' },
    { key: 'en_alistamiento', label: 'En alistamiento', color: '#3a9fd6', bg: '#eaf4ff' },
    { key: 'por_entregar',    label: 'Por entregar',    color: '#6c3fc4', bg: '#e8deff' },
    { key: 'entregado',       label: 'Entregado',       color: '#22c55e', bg: '#dcfce7' },
    { key: 'cancelado',       label: 'Cancelado',       color: '#ef4444', bg: '#fee2e2' },
  ];
  panel.innerHTML = items.map((item, i) => `
    <div class="d-flex items-center justify-between" style="padding:var(--s-3) 0;${i < items.length - 1 ? 'border-bottom:1px solid var(--color-border);' : ''}">
      <div class="d-flex items-center gap-3">
        <div class="size-10 shrink-0" style="border-radius:50%;background:${item.color}"></div>
        <span class="text-sm text-muted">${item.label}</span>
      </div>
      <span class="text-base font-bold text-ink radius-pill" style="background:${item.bg};padding:2px 12px">${counts[item.key] || 0}</span>
    </div>`).join('');
}

/* ── Clientes recientes ──────────────────────────────────── */
function renderRecentClients(clientes, pedidos) {
  const tbody = document.getElementById('recentClientsBody');
  if (!tbody) return;
  const stats = {};
  pedidos.filter(p => p.estado !== 'cancelado').forEach(p => {
    if (!p.cliente_id) return;
    if (!stats[p.cliente_id]) stats[p.cliente_id] = { count: 0, total: 0 };
    stats[p.cliente_id].count++;
    stats[p.cliente_id].total += (+p.valor_venta || 0);
  });
  const recent = clientes.slice(0, 4);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td class="text-center text-muted" colspan="4" style="padding:32px">Sin clientes aún</td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(c => {
    const s = stats[c.id] || { count: 0, total: 0 };
    return `
      <tr class="cursor-pointer">
        <td>
          <div class="d-flex items-center gap-3">
            <div class="d-flex items-center justify-center text-sm font-bold text-white shrink-0" style="width:34px;height:34px;border-radius:50%;background:var(--grad-primary)">
              ${(c.nombre || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <a class="text-sm font-semibold text-ink" href="/cliente.html?id=${c.id || ''}" style="text-decoration:none" onmouseover="this.style.color='var(--color-violet)'" onmouseout="this.style.color='var(--color-text)'">${c.nombre}</a>
              <p class="text-xs text-muted">${c.celular || '—'}</p>
            </div>
          </div>
        </td>
        <td class="text-sm text-muted">${c.ciudad || '—'}</td>
        <td class="text-sm text-center">${s.count}</td>
        <td class="font-semibold text-violet">${fmt(s.total)}</td>
      </tr>`;
  }).join('');
}

/* ── Ranking vendedores ──────────────────────────────────── */
function renderVendedorRanking(pedidos) {
  const panel = document.getElementById('vendedorRankingPanel');
  if (!panel) return;
  const mes = getPedidosMes(pedidos, 0).filter(p => p.estado !== 'cancelado');
  const byV = {};
  mes.forEach(p => {
    const v = p.vendedor || 'Sin asignar';
    if (!byV[v]) byV[v] = { ventas: 0, ganancias: 0, pedidos: 0, comision: 0 };
    byV[v].ventas    += (+p.valor_venta || 0);
    byV[v].ganancias += (+p.ganancias   || 0);
    byV[v].pedidos   += 1;
    byV[v].comision  += (+p.comision    || 0);
  });
  const sorted = Object.entries(byV).sort((a, b) => b[1].ventas - a[1].ventas);
  const now = new Date();
  const labelEl = document.getElementById('rankingMesLabel');
  if (labelEl) labelEl.textContent = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  if (!sorted.length) {
    panel.innerHTML = `<p class="p-5 text-muted text-center">Sin ventas este mes</p>`;
    return;
  }
  const medals = ['🥇','🥈','🥉'];
  panel.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>#</th><th>Vendedor</th><th>Pedidos</th><th>Ventas</th><th>Ganancias</th><th>Comisión</th></tr></thead>
      <tbody>
        ${sorted.map(([nombre, d], i) => `
          <tr>
            <td class="text-base text-center">${medals[i] || i + 1}</td>
            <td>
              <div class="d-flex items-center gap-2">
                <div class="d-flex items-center justify-center text-xs font-bold text-white shrink-0" style="width:30px;height:30px;border-radius:50%;background:var(--grad-primary)">
                  ${nombre.charAt(0).toUpperCase()}
                </div>
                <span class="text-sm font-semibold">${nombre}</span>
              </div>
            </td>
            <td class="text-center text-sm">${d.pedidos}</td>
            <td class="font-semibold text-violet">${fmtShort(d.ventas)}</td>
            <td class="font-semibold" style="color:#22c55e">${fmtShort(d.ganancias)}</td>
            <td class="text-sm text-muted">${fmtShort(d.comision)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ── Canal de adquisición ────────────────────────────────── */
function renderCanalAdquisicion(clientes, pedidos) {
  const panel = document.getElementById('canalAdquisicionPanel');
  if (!panel) return;
  const byCanal = {};
  clientes.forEach(c => {
    const canal = c.origen_venta || 'Sin registrar';
    byCanal[canal] = (byCanal[canal] || 0) + 1;
  });
  const ventasByCanal = {};
  pedidos.filter(p => p.estado !== 'cancelado').forEach(p => {
    const canal = p.origen || 'Sin registrar';
    if (!ventasByCanal[canal]) ventasByCanal[canal] = 0;
    ventasByCanal[canal] += (+p.valor_venta || 0);
  });
  const canales = [...new Set([...Object.keys(byCanal), ...Object.keys(ventasByCanal)])];
  const sorted  = canales
    .map(c => ({ canal: c, clientes: byCanal[c] || 0, ventas: ventasByCanal[c] || 0 }))
    .sort((a, b) => b.clientes - a.clientes);
  const ICON_MAP = { 'facebook': '📘', 'whatsapp': '💬', 'referido': '👥', 'cliente': '🏪', 'sin registrar': '❓', 'lilop': '🛍️' };
  function getIcon(nombre) {
    const key = (nombre || '').toLowerCase();
    for (const [k, v] of Object.entries(ICON_MAP)) { if (key.includes(k)) return v; }
    return '📍';
  }
  // Incluir orígenes registrados aunque no tengan clientes aún
  const total = sorted.reduce((s, c) => s + c.clientes, 0) || 1;
  if (!sorted.length) {
    panel.innerHTML = `<p class="text-muted text-center">Sin datos de canal</p>`;
    return;
  }
  panel.innerHTML = `
    <div class="d-flex flex-col gap-4">
      ${sorted.map(item => `
        <div>
          <div class="d-flex items-center justify-between" style="margin-bottom:6px">
            <div class="d-flex items-center gap-2">
              <span style="font-size:16px;">${getIcon(item.canal)}</span>
              <span class="text-sm font-semibold text-ink">${item.canal}</span>
            </div>
            <div class="d-flex items-center gap-3">
              <span class="text-xs text-muted">${item.clientes} cliente${item.clientes !== 1 ? 's' : ''}</span>
              ${item.ventas > 0 ? `<span class="text-xs font-semibold text-violet">${fmtShort(item.ventas)}</span>` : ''}
            </div>
          </div>
          <div class="radius-pill" style="height:8px;background:var(--color-fog);overflow:hidden">
            <div class="radius-pill" style="height:100%;width:${Math.round((item.clientes / total) * 100)}%;background:var(--grad-primary);transition:width .8s"></div>
          </div>
        </div>`).join('')}
    </div>`;
}

/* ── Cuentas por cobrar ──────────────────────────────────── */
function renderCuentasPorCobrar(pedidos) {
  const tbody = document.getElementById('cuentasPorCobrarBody');
  if (!tbody) return;
  const cxc = pedidos
    .filter(p => p.estado === 'entregado' && p.medio_pago === 'Por confirmar')
    .sort((a, b) => new Date(b.fecha_entrega || b.fecha_venta) - new Date(a.fecha_entrega || a.fecha_venta));
  if (!cxc.length) {
    tbody.innerHTML = `
      <tr><td class="text-center" colspan="4" style="padding:32px">
        <span style="color:#22c55e;font-size:24px;">✓</span><br/>
        <span class="text-muted text-sm">Sin cuentas pendientes</span>
      </td></tr>`;
    return;
  }
  tbody.innerHTML = cxc.map(p => {
    const fecha = (p.fecha_entrega || p.fecha_venta)
      ? new Date(p.fecha_entrega || p.fecha_venta).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
      : '—';
    const diasPendiente = p.fecha_entrega
      ? Math.floor((new Date() - new Date(p.fecha_entrega)) / 86400000)
      : null;
    return `
      <tr class="cursor-pointer" onclick="window.location.href='pedidos.html?id=${p.id}'">
        <td>
          <span class="font-semibold text-sm">${p.id}</span>
        </td>
        <td class="text-sm"><a class="text-ink" href="/cliente.html?id=${p.cliente_id || ''}" style="text-decoration:none" onmouseover="this.style.color='var(--color-violet)'" onmouseout="this.style.color='var(--color-text)'">${p.cliente || '—'}</a></td>
        <td class="font-semibold text-violet">${fmt(p.valor_venta)}</td>
        <td>
          <span class="text-xs">${fecha}</span>
          ${diasPendiente !== null ? `<br/><span class="text-xs" style="color:${diasPendiente > 3 ? '#ef4444' : '#f59e0b'}">${diasPendiente}d pendiente</span>` : ''}
        </td>
      </tr>`;
  }).join('');
}

/* ── Clientes nuevos vs recurrentes ─────────────────────── */
function renderRetencion(clientes, pedidos) {
  const panel = document.getElementById('retencionPanel');
  if (!panel) return;
  const now = new Date();
  const labelEl = document.getElementById('retencionMesLabel');
  if (labelEl) labelEl.textContent = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  /* Clientes que compraron este mes */
  const mesPedidos = getPedidosMes(pedidos, 0).filter(p => p.estado !== 'cancelado');
  const clientesMes = new Set(mesPedidos.map(p => p.cliente_id).filter(Boolean));

  /* Pedidos anteriores al mes actual */
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const pedidosAnteriores = pedidos.filter(p =>
    p.estado !== 'cancelado' && p.fecha_venta && new Date(p.fecha_venta) < inicio
  );
  const clientesAnteriores = new Set(pedidosAnteriores.map(p => p.cliente_id).filter(Boolean));

  let nuevos = 0, recurrentes = 0;
  clientesMes.forEach(id => {
    if (clientesAnteriores.has(id)) recurrentes++;
    else nuevos++;
  });

  const total = nuevos + recurrentes || 1;
  const pctNuevos     = Math.round((nuevos     / total) * 100);
  const pctRecurrentes = Math.round((recurrentes / total) * 100);

  /* LTV promedio: total gastado / clientes con más de 1 pedido */
  const gastoPorCliente = {};
  pedidos.filter(p => p.estado !== 'cancelado' && p.cliente_id).forEach(p => {
    if (!gastoPorCliente[p.cliente_id]) gastoPorCliente[p.cliente_id] = 0;
    gastoPorCliente[p.cliente_id] += (+p.valor_venta || 0);
  });
  const totalClientes = Object.keys(gastoPorCliente).length;
  const ltv = totalClientes > 0
    ? Object.values(gastoPorCliente).reduce((s, v) => s + v, 0) / totalClientes
    : 0;

  panel.innerHTML = `
    <div class="d-flex flex-col gap-5">

      <!-- Barra visual -->
      <div>
        <div class="d-flex radius-pill mb-3" style="height:12px;overflow:hidden">
          <div style="width:${pctNuevos}%;background:var(--grad-primary);transition:width .8s;"></div>
          <div style="width:${pctRecurrentes}%;background:#22c55e;transition:width .8s;"></div>
        </div>
        <div class="d-flex gap-4">
          <div class="d-flex items-center gap-2">
            <div class="size-10" style="border-radius:50%;background:var(--color-violet)"></div>
            <span class="text-xs text-muted">Nuevos</span>
          </div>
          <div class="d-flex items-center gap-2">
            <div class="size-10" style="border-radius:50%;background:#22c55e"></div>
            <span class="text-xs text-muted">Recurrentes</span>
          </div>
        </div>
      </div>

      <!-- Números -->
      <div class="d-grid gap-4" style="grid-template-columns:1fr 1fr">
        <div class="p-4 text-center" style="background:var(--color-fog);border-radius:var(--r-base)">
          <div class="text-2xl font-bold text-violet">${nuevos}</div>
          <div class="text-xs text-muted">Nuevos (${pctNuevos}%)</div>
        </div>
        <div class="p-4 text-center" style="background:var(--color-fog);border-radius:var(--r-base)">
          <div class="text-2xl font-bold" style="color:#22c55e">${recurrentes}</div>
          <div class="text-xs text-muted">Recurrentes (${pctRecurrentes}%)</div>
        </div>
      </div>

      <!-- LTV -->
      <div style="border-top:1px solid var(--color-border);padding-top:var(--s-4);">
        <div class="d-flex justify-between items-center">
          <span class="text-sm text-muted">LTV promedio por cliente</span>
          <span class="text-base font-bold text-violet">${fmtShort(ltv)}</span>
        </div>
        <div class="d-flex justify-between items-center mt-2">
          <span class="text-sm text-muted">Total clientes con compras</span>
          <span class="text-base font-bold text-ink">${totalClientes}</span>
        </div>
      </div>
    </div>`;
}

/* ── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (window.AdminLayout) window.AdminLayout.init('Dashboard');
  showLoadingStates();

  let pedidos = [], clientes = [];
  try {
    [pedidos, clientes] = await Promise.all([
      window.AdminApi.get('/pedidos'),
      window.AdminApi.get('/clientes'),
    ]);
    if (!Array.isArray(pedidos))  pedidos  = pedidos.data  || pedidos.pedidos  || [];
    if (!Array.isArray(clientes)) clientes = clientes.data || clientes.clientes || [];
  } catch (err) {
    console.error('Dashboard error:', err);
    window.AdminToast?.error('Error al cargar datos', 'Verifica tu conexión e intenta de nuevo');
    return;
  }

  /* ── Poblar selector de mes ── */
  function poblarSelectorMes() {
    const sel = document.getElementById('filtromes');
    if (!sel) return;
    const meses = new Set();
    pedidos.forEach(p => {
      if (!p.fecha_venta) return;
      const d = new Date(p.fecha_venta);
      meses.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    const now = new Date();
    const actual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!meses.has(actual)) meses.add(actual);
    const sorted = [...meses].sort((a, b) => b.localeCompare(a));
    sel.innerHTML = sorted.map(m => {
      const [y, mo] = m.split('-');
      const label = new Date(+y, +mo - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
      return `<option value="${m}" ${m === actual ? 'selected' : ''}>${label}</option>`;
    }).join('');
  }

  /* ── Filtrar datos por mes seleccionado ── */
  function filtrarPorMes(año, mes) {
    return pedidos.filter(p => {
      if (!p.fecha_venta) return false;
      const d = new Date(p.fecha_venta);
      return d.getFullYear() === año && d.getMonth() + 1 === mes;
    });
  }

  function filtrarClientesPorMes(año, mes) {
    const pedidosMes = filtrarPorMes(año, mes);
    const clienteIds = new Set(pedidosMes.map(p => p.cliente_id).filter(Boolean));
    return clientes.filter(c => clienteIds.has(c.id));
  }

  /* ── Renderizar todo con el mes seleccionado ── */
  function renderTodo() {
    const sel = document.getElementById('filtromes');
    const val = sel?.value || '';
    const [y, m] = val.split('-').map(Number);
    const pedidosMes   = val ? filtrarPorMes(y, m) : pedidos;
    const clientesMes  = val ? filtrarClientesPorMes(y, m) : clientes;

    renderStatCards(pedidos);
    renderRecentOrders(pedidosMes);
    renderMedioPago(pedidosMes);
    renderOrdersFunnel(pedidosMes);
    renderRecentClients(clientesMes, pedidosMes);
    renderVendedorRanking(pedidosMes);
    renderCanalAdquisicion(clientes, pedidos);
    renderCuentasPorCobrar(pedidosMes);
    renderRetencion(clientesMes, pedidosMes);
  }

  poblarSelectorMes();
  renderTodo();
  renderChart(pedidos, 7);

  document.getElementById('filtromes')?.addEventListener('change', renderTodo);
  document.getElementById('btnMesHoy')?.addEventListener('click', () => {
    const now = new Date();
    const actual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const sel = document.getElementById('filtromes');
    if (sel) { sel.value = actual; renderTodo(); }
  });

  document.querySelectorAll('.chart-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-period-btn').forEach(b => {
        b.classList.remove('is-active', 'btn--outline');
        b.classList.add('btn--ghost');
      });
      btn.classList.add('is-active', 'btn--outline');
      btn.classList.remove('btn--ghost');
      renderChart(pedidos, parseInt(btn.dataset.period));
    });
  });

  const porConf = pedidos.filter(p => p.estado === 'por_confirmar').length;
  if (porConf > 0) {
    setTimeout(() => {
      window.AdminToast?.info(
        `${porConf} pedido${porConf > 1 ? 's' : ''} por confirmar`,
        'Revisa la sección de pedidos'
      );
    }, 800);
  }

  /* Alerta cuentas por cobrar */
  const cxc = pedidos.filter(p => p.estado === 'entregado' && p.medio_pago === 'Por confirmar');
  if (cxc.length > 0) {
    setTimeout(() => {
      window.AdminToast?.info(
        `${cxc.length} cuenta${cxc.length > 1 ? 's' : ''} por cobrar`,
        'Pedidos entregados sin pago confirmado'
      );
    }, 1600);
  }
});
