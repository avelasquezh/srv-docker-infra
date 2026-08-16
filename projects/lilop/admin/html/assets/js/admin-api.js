'use strict';

const AdminApi = (() => {

  const BASE_URL = 'https://api.lilop.store/api';

  function getToken() {
    try {
      const raw = localStorage.getItem('lilop_admin_session');
      if (raw) return JSON.parse(raw)?.token || null;
    } catch {}
    return null;
  }

  function headers() {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function handleResponse(res) {
    if (res.status === 401) {
      localStorage.removeItem('lilop_admin_session');
      window.location.href = '/login.html';
      throw new Error('Sesión expirada');
    }
    if (res.status === 404) throw new Error('404 Not found');
    if (res.status === 403) throw new Error('403 Forbidden');
    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try { const body = await res.json(); msg = body.error || body.message || msg; } catch {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    async get(path) {
      const res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers: headers() });
      return handleResponse(res);
    },
    async post(path, body) {
      const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      return handleResponse(res);
    },
    async put(path, body) {
      const res = await fetch(`${BASE_URL}${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
      return handleResponse(res);
    },
    async patch(path, body) {
      const res = await fetch(`${BASE_URL}${path}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(body) });
      return handleResponse(res);
    },
    async delete(path) {
      const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers: headers() });
      return handleResponse(res);
    },
  };

})();

window.AdminApi = AdminApi;
