/* ============================================================
   Lilop — pages/gracias.js
   Responsabilidad única: página de confirmación de pedido.
   - Lee el último pedido guardado en localStorage por pago.js
   - Renderiza resumen del pedido (items + total)
   - Muestra el número de pedido
   - Si no hay pedido redirige al home
   ============================================================ */

'use strict';

const store = window.LilopStore;

document.addEventListener('DOMContentLoaded', () => {
  let order = null;

  try {
    const raw = localStorage.getItem('lilop_last_order');
    if (raw) order = JSON.parse(raw);
  } catch { /* silencioso */ }

  if (!order) {
    /* Sin pedido reciente → redirigir al home */
    window.location.href = '/index.html';
    return;
  }

  /* Número de pedido */
  const orderIdEl = document.getElementById('thanksOrderId');
  if (orderIdEl) {
    orderIdEl.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Pedido ${order.id}
    `;
  }

  /* Resumen */
  const summaryEl = document.getElementById('thanksSummary');
  if (summaryEl && order.items?.length) {
    const itemsHTML = order.items.map((item) => `
      <div class="thanks-summary__item">
        <div class="thanks-summary__img">
          <img src="${item.image || '/assets/img/placeholder.jpg'}"
               alt="${item.name}" loading="lazy"
               onerror="this.src='/assets/img/placeholder.jpg'"/>
        </div>
        <div style="flex:1;min-width:0;">
          <p class="thanks-summary__name">${item.name} × ${item.quantity}</p>
          ${item.variant ? `<p class="thanks-summary__variant">${item.variant}</p>` : ''}
        </div>
        <span class="thanks-summary__price">
          ${store.formatPrice(item.price * item.quantity)}
        </span>
      </div>
    `).join('');

    summaryEl.innerHTML = `
      ${itemsHTML}
      <div class="thanks-summary__total-row">
        <span>Total pagado</span>
        <span class="thanks-summary__total-amount">${store.formatPrice(order.total)}</span>
      </div>
    `;
  }

  /* Limpiar el pedido de localStorage después de mostrarlo */
  /* Se deja un delay para que el usuario pueda volver y verlo */
  setTimeout(() => {
    try { localStorage.removeItem('lilop_last_order'); } catch { /* silencioso */ }
  }, 30 * 60 * 1000); /* 30 minutos */
});