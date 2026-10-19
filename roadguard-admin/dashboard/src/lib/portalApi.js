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

async function refreshSessionToken(expectedToken) {
  const currentAuth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
  if (!currentAuth?.accessToken) return { auth: null, invalid: true };
  if (currentAuth.accessToken !== expectedToken) return { auth: currentAuth, invalid: false };

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${expectedToken}` }
    });
    if (response.status === 401) return { auth: null, invalid: true };
    if (!response.ok) return { auth: currentAuth, invalid: false };

    const result = await response.json();
    if (!result?.accessToken) return { auth: currentAuth, invalid: false };
    const latestAuth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
    if (!latestAuth) return { auth: null, invalid: true };
    if (latestAuth.accessToken !== expectedToken) return { auth: latestAuth, invalid: false };

    const refreshedAuth = { ...latestAuth, accessToken: result.accessToken };
    sessionStorage.setItem('roadguard.auth', JSON.stringify(refreshedAuth));
    const refreshedAt = Date.now();
    sessionStorage.setItem(LAST_REFRESH_KEY, String(refreshedAt));
    return { auth: refreshedAuth, invalid: false };
  } catch {
    return { auth: currentAuth, invalid: false };
  }
}

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
      const result = await refreshSessionToken(currentAuth.accessToken);
      if (result.auth?.accessToken) {
        lastRefresh = Number(sessionStorage.getItem(LAST_REFRESH_KEY)) || lastRefresh;
      } else if (result.invalid) {
        const latestAuth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
        if (latestAuth?.accessToken === currentAuth.accessToken) {
          endSession();
          window.location.replace('/admin/signin.html');
        }
      }
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
  const requestOptions = { ...options, headers };
  let response = await fetch(`/api/portal${path}`, requestOptions);
  let responseAuthToken = requestAuth?.accessToken;
  let authInvalid = false;
  if (response.status === 401 && requestAuth?.accessToken) {
    const refreshed = await refreshSessionToken(requestAuth.accessToken);
    if (refreshed.auth?.accessToken && refreshed.auth.accessToken !== requestAuth.accessToken) {
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set('Authorization', `Bearer ${refreshed.auth.accessToken}`);
      if (options.body && !retryHeaders.has('Content-Type')) retryHeaders.set('Content-Type', 'application/json');
      response = await fetch(`/api/portal${path}`, { ...options, headers: retryHeaders });
      responseAuthToken = refreshed.auth.accessToken;
      authInvalid = response.status === 401;
    } else if (refreshed.invalid) {
      authInvalid = true;
      const latestAuth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
      if (latestAuth?.accessToken === requestAuth.accessToken) {
        sessionStorage.removeItem('roadguard.auth');
        window.location.replace('/admin/signin.html');
      }
    }
  }
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (response.status === 401 && authInvalid) {
    const latestAuth = JSON.parse(sessionStorage.getItem('roadguard.auth') || 'null');
    if (latestAuth?.accessToken === responseAuthToken) {
      sessionStorage.removeItem('roadguard.auth');
      window.location.replace('/admin/signin.html');
    }
  }
  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error('The backend server is temporarily unavailable. Please try again shortly.');
    }
    const contentType = response.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html') || /^\s*<(?:!doctype\s+html|html|head|body)[\s>]/i.test(text);
    if (isHtml) throw new Error('The server returned an unexpected response. Please try again.');
    const message = typeof data?.message === 'string' ? data.message.slice(0, 300)
      : typeof data?.detail === 'string' ? data.detail.slice(0, 300) : '';
    throw new Error(message || `Request failed (${response.status})`);
  }
  return data;
}
