'use strict';

(function() {

  const NAV_ITEMS = [
    {
      section: 'Principal',
      items: [
        { href: 'index.html',         label: 'Dashboard',     icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { href: 'clientes.html',      label: 'Clientes',      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
        { href: 'pedidos.html',       label: 'Pedidos',       icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', badge: 'pedidos' },
        { href: 'productos.html',     label: 'Productos',     icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      ]
    },
    {
      section: 'Catálogo',
      items: [
        { href: 'disenos.html',       label: 'Diseños',       icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
        { label: 'Configuración', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
          children: [
            { href: 'configuracion.html?seccion=general',   label: 'General',   icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
            { href: 'configuracion.html?seccion=seguridad', label: 'Seguridad', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
            { href: 'configuracion.html?seccion=usuarios',  label: 'Usuarios',  icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
            { href: 'configuracion.html?seccion=maestros',  label: 'Maestros',  icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
          ]
        },
      ]
    },
  ];

  function renderSidebar(pendientes = 0) {
    const sidebar = document.getElementById('adminSidebar');
    if (!sidebar) return;

    const sectionsHTML = NAV_ITEMS.map(s => `
      <div class="admin-nav__section">
        <span class="admin-nav__label">${s.section}</span>
        ${s.items.map(item => {
          const badge = (item.badge === 'pedidos' && pendientes > 0)
            ? '<span class="admin-nav__badge">' + pendientes + '</span>' : '';
          if (item.children) {
            const current = window.location.pathname.split('/').pop() + window.location.search;
            const isActive = item.children.some(c => current.includes(c.href));
            const childrenHTML = item.children.map(c =>
              '<a href="' + c.href + '" class="admin-nav__item admin-nav__item--child">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="' + c.icon + '"/></svg>' +
                c.label + '</a>'
            ).join('');
            return '<div class="admin-nav__group' + (isActive ? ' is-open' : '') + '">' +
              '<button class="admin-nav__item admin-nav__group-btn" onclick="this.parentElement.classList.toggle(&quot;is-open&quot;)">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="' + item.icon + '"/></svg>' +
                item.label +
                '<svg class="admin-nav__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
              '</button>' +
              '<div class="admin-nav__children">' + childrenHTML + '</div>' +
            '</div>';
          }
          return '<a href="' + item.href + '" class="admin-nav__item">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + item.icon + '"/></svg>' +
            item.label + badge + '</a>';
        }).join('')}
      </div>
    `).join('');

    sidebar.innerHTML =
      '<a href="index.html" class="admin-sidebar__logo">' +
        '<div class="admin-sidebar__logo-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>' +
            '<polyline points="9 22 9 12 15 12 15 22"/>' +
          '</svg>' +
        '</div>' +
        '<div>' +
          '<p class="admin-sidebar__logo-text">Lilop</p>' +
          '<p class="admin-sidebar__logo-sub">Panel admin</p>' +
        '</div>' +
      '</a>' +
      '<nav class="admin-nav" aria-label="Navegación del panel">' + sectionsHTML + '</nav>' +
      '<div class="admin-sidebar__footer">' +
        '<div class="admin-sidebar__user">' +
          '<div class="admin-sidebar__avatar" data-user-initials>A</div>' +
          '<div>' +
            '<p class="admin-sidebar__user-name" data-user-name>Admin</p>' +
            '<p class="admin-sidebar__user-role" data-user-role>Administrador</p>' +
          '</div>' +
          '<button class="admin-sidebar__logout" data-logout aria-label="Cerrar sesión">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  function renderTopbar(pageTitle, pendientes = 0) {
    const topbar = document.getElementById('adminTopbar');
    if (!topbar) return;

    const badgeHTML  = pendientes > 0
      ? '<span class="admin-topbar__btn-badge d-flex">' + pendientes + '</span>'
      : '<span class="admin-topbar__btn-badge d-none">0</span>';

    topbar.innerHTML =
      '<div class="admin-topbar__left">' +
        '<button class="admin-topbar__menu-btn" id="menuBtn" aria-label="Abrir menú">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>' +
          '</svg>' +
        '</button>' +
        '<h1 class="admin-topbar__page-title">' + (pageTitle || 'Dashboard') + '</h1>' +
      '</div>' +

      '<div class="admin-topbar__right">' +
        '<button class="admin-topbar__btn" aria-label="Notificaciones">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>' +
          '</svg>' +
          badgeHTML +
        '</button>' +
        '<div class="admin-topbar__divider"></div>' +
        '<a href="https://lilop.store" target="_blank" class="admin-topbar__view-site">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>' +
          '</svg>' +
          'Ver sitio' +
        '</a>' +
      '</div>';
  }

  function initActiveNav() {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.admin-nav__item').forEach(function(item) {
      const href = (item.getAttribute('href') || '').split('/').pop();
      if (href === current) item.classList.add('is-active');
    });
  }

  function initMobileMenu() {
    const sidebar  = document.getElementById('adminSidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    const menuBtn  = document.getElementById('menuBtn');
    const logoutBtn = document.querySelector('[data-logout]');

    function openSidebar() {
      sidebar?.classList.add('is-open');
      overlay?.classList.add("is-open");
      document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
      sidebar?.classList.remove('is-open');
      overlay?.classList.remove("is-open");
      document.body.style.overflow = '';
    }

    menuBtn?.addEventListener('click', openSidebar);
    overlay?.addEventListener('click', closeSidebar);

    document.querySelectorAll('.admin-nav__item').forEach(function(item) {
      item.addEventListener('click', function() {
        if (window.innerWidth < 1024) closeSidebar();
      });
    });

    logoutBtn?.addEventListener('click', function() {
      window.AdminAuth?.logout();
    });
  }

  window.AdminLayout = {
    init: function(pageTitle) {
      renderSidebar(0);
      renderTopbar(pageTitle, 0);
      function doInit() {
        initActiveNav();
        initMobileMenu();
        var session = window.AdminAuth ? window.AdminAuth.getSession() : null;
        if (session && window.AdminAuth) {
          window.AdminAuth.populateUserInfo(session);
        }
        if (window.AdminApi) {
          window.AdminApi.get('/pedidos?estado=por_confirmar').then(function(data) {
            var count = Array.isArray(data) ? data.length : 0;
            renderSidebar(count);
            renderTopbar(pageTitle, count);
            initActiveNav();
            initMobileMenu();
          }).catch(function() {});
        }
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', doInit);
      } else {
        doInit();
      }
    }
  };

})();