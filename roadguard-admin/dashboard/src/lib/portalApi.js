export function authHeaders(initial = {}) {
  const auth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
  if (!auth?.username || !auth?.password) throw new Error('Sign in to access your organization portal.');
  const headers = new Headers(initial || {});
  headers.set('Authorization', `Basic ${btoa(`${auth.username}:${auth.password}`)}`);
  return headers;
}

export async function portalApi(path, options = {}) {
  const headers = authHeaders(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api/portal${path}`, { ...options, headers });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) throw new Error(data?.message || data?.detail || `Request failed (${response.status})`);
  return data;
}
