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

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const TOKEN_REFRESH_MS = 5 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'roadguard.lastActivity';
const LAST_REFRESH_KEY = 'roadguard.lastTokenRefresh';

export function startSessionActivityMonitor() {
  const auth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
  if (!auth?.accessToken) return () => {};

  const now = Date.now();
  let lastActivity = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY)) || now;
  let lastRefresh = Number(sessionStorage.getItem(LAST_REFRESH_KEY)) || now;
  let refreshInFlight = false;
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
  sessionStorage.setItem(LAST_REFRESH_KEY, String(lastRefresh));

  const markActivity = () => {
    const activityAt = Date.now();
    if (activityAt - lastActivity < 1000) return;
    lastActivity = activityAt;
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
  };

  const interval = window.setInterval(async () => {
    const current = Date.now();
    const storedActivity = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY)) || lastActivity;
    if (storedActivity > lastActivity) lastActivity = storedActivity;
    if (current - lastActivity >= IDLE_TIMEOUT_MS) {
      window.clearInterval(interval);
      endSession();
      window.location.replace('/admin/signin.html');
      return;
    }
    if (document.visibilityState === 'hidden' || current - lastRefresh < TOKEN_REFRESH_MS || refreshInFlight) return;

    const currentAuth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
    if (!currentAuth?.accessToken) return;
    refreshInFlight = true;
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentAuth.accessToken}` }
      });
      if (response.status === 401) {
        const latestAuth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
        if (latestAuth?.accessToken === currentAuth.accessToken) {
          endSession();
          window.location.replace('/admin/signin.html');
        }
        return;
      }
      if (!response.ok) return;
      const result = await response.json();
      if (!result?.accessToken) return;
      const latestAuth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
      if (!latestAuth || latestAuth.accessToken !== currentAuth.accessToken) return;
      sessionStorage.setItem('roadguard.auth', JSON.stringify({ ...latestAuth, accessToken: result.accessToken }));
      lastRefresh = Date.now();
      sessionStorage.setItem(LAST_REFRESH_KEY, String(lastRefresh));
    } catch {
      // Keep the current session on transient network errors and retry later.
    } finally {
      refreshInFlight = false;
    }
  }, 5_000);

  const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
  events.forEach(eventName => window.addEventListener(eventName, markActivity, { passive: true }));
  return () => {
    window.clearInterval(interval);
    events.forEach(eventName => window.removeEventListener(eventName, markActivity));
  };
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
  const requestAuth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
  const headers = authHeaders(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api/portal${path}`, { ...options, headers });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (response.status === 401) {
    const latestAuth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
    if (latestAuth?.accessToken === requestAuth?.accessToken) {
      sessionStorage.removeItem('roadguard.auth');
      window.location.replace('/admin/signin.html');
    }
  }
  if (!response.ok) throw new Error(data?.message || data?.detail || `Request failed (${response.status})`);
  return data;
}
