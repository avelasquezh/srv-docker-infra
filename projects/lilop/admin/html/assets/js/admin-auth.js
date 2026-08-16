'use strict';

const AdminAuth = {
  SESSION_KEY: 'lilop_admin_session',
  API_BASE:    'https://api.lilop.store',

  async login(email, password) {
    try {
      const res = await fetch(`${this.API_BASE}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Credenciales inválidas' };

      const session = {
        token:     data.token,
        user:      data.usuario.email,
        name:      data.usuario.nombre,
        role:      data.usuario.rol,
        id:        data.usuario.id,
        loginAt:   new Date().toISOString(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      };
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      return { ok: true, session };
    } catch (err) {
      return { ok: false, error: 'No se pudo conectar con el servidor' };
    }
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    window.location.href = '/login.html';
  },

  getSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (new Date(session.expiresAt) < new Date()) {
        this.logout();
        return null;
      }
      return session;
    } catch { return null; }
  },

  guard() {
    const session = this.getSession();
    if (!session) {
      window.location.href = '/login.html';
      return false;
    }
    return session;
  },

  populateUserInfo(session) {
    if (!session) return;
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = session.name);
    document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = 'Administrador');
    document.querySelectorAll('[data-user-initials]').forEach(el => el.textContent = session.name.charAt(0));
  },
};

window.AdminAuth = AdminAuth;
