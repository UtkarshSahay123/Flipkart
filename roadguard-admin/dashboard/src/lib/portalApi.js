export function endSession() {
  const auth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
  sessionStorage.removeItem('roadguard.auth');
  if (auth?.accessToken) {
    fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        keepalive: true
      }).catch(() => {});
  }
}

export function authHeaders(initial = {}) {
  const auth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
  if (!auth?.accessToken) {
    sessionStorage.removeItem('roadguard.auth');
    throw new Error('Your session expired. Sign in again to continue.');
  }
  const headers = new Headers(initial || {});
  headers.set('Authorization', `Bearer ${auth.accessToken}`);
  return headers;
}

export async function portalApi(path, options = {}) {
  const headers = authHeaders(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api/portal${path}`, { ...options, headers });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (response.status === 401) {
    sessionStorage.removeItem('roadguard.auth');
    window.location.replace('/admin/signin.html');
  }
  if (!response.ok) throw new Error(data?.message || data?.detail || `Request failed (${response.status})`);
  return data;
}
