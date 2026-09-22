import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export const BASE_URL =
  Constants?.expoConfig?.extra?.apiUrl ||
  process.env.API_URL ||
  'https://parko-wxij.onrender.com/api';

// 90s: Render free tier cold-starts (~25s) after idle; short timeouts falsely report "server down".
export const api = axios.create({ baseURL: BASE_URL, timeout: 90000 });

let onUnauthorized = null;
export const setOnUnauthorized = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.request.use(async (cfg) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig = error.config || {};
    const status = error.response?.status;
    const url = orig.url || '';
    if (status === 401 && !orig._retried && !url.includes('/auth/')) {
      orig._retried = true;
      try {
        refreshing =
          refreshing ||
          (async () => {
            const rt = await SecureStore.getItemAsync('refreshToken');
            if (!rt) throw new Error('no-refresh');
            const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: rt }, { timeout: 30000 });
            await SecureStore.setItemAsync('accessToken', data.data.accessToken);
            return data.data.accessToken;
          })();
        const fresh = await refreshing;
        refreshing = null;
        orig.headers.Authorization = `Bearer ${fresh}`;
        return api(orig);
      } catch (e) {
        refreshing = null;
        await clearTokens();
        if (onUnauthorized) onUnauthorized();
        return Promise.reject(error);
      }
    }
    // One silent retry on network timeout (cold start): only for safe calls —
    // GETs plus login/refresh (no side effects). Never auto-retry data writes.
    const method = (orig.method || 'get').toLowerCase();
    const safeRetry =
      !error.response && !orig._timeoutRetried && (method === 'get' || url.includes('/auth/login') || url.includes('/auth/refresh'));
    if (safeRetry) {
      orig._timeoutRetried = true;
      return api(orig);
    }
    return Promise.reject(error);
  }
);

export const saveTokens = (access, refresh) =>
  Promise.all([
    SecureStore.setItemAsync('accessToken', access || ''),
    SecureStore.setItemAsync('refreshToken', refresh || ''),
  ]);

export const clearTokens = () =>
  Promise.all([SecureStore.deleteItemAsync('accessToken'), SecureStore.deleteItemAsync('refreshToken')]);

// Best-effort wake-up ping for sleeping free-tier servers. Never throws.
export async function wakeServer() {
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 90000 });
    return true;
  } catch {
    return false;
  }
}

// Human-friendly message for any API failure (validation-aware, never leaks internals).
export function errMsg(e, fallback = 'Something went wrong. Please try again.') {
  const d = e?.response?.data;
  if (!d) {
    if (e?.code === 'ECONNABORTED' || (e?.message || '').toLowerCase().includes('timeout')) {
      return 'Server is waking up. Please wait a few seconds and try again.';
    }
    return e?.message === 'Network Error' ? 'No connection to the server. Check internet and retry.' : fallback;
  }
  if (d.details?.fieldErrors) {
    const parts = Object.entries(d.details.fieldErrors).map(([k, v]) => `${k}: ${[]
      .concat(v)
      .join(', ')}`);
    if (parts.length) return parts.join('\n');
  }
  if (typeof d.error === 'string') {
    if (d.error === 'Internal server error') return 'Server error. Please try again in a moment.';
    return d.error;
  }
  return fallback;
}
