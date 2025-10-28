// Lightweight API client with auth, timeouts, retries, and JSON parsing.
// Uses Firebase Auth to attach ID token when available.

import { auth } from "../firebase/firebaseConfig";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getIdTokenSafe(forceRefresh = false) {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken(forceRefresh);
  } catch (_) {
    return null;
  }
}

async function request(method, url, body, { timeoutMs = 20000, retries = 1, requireAuth = false, headers = {} } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const authToken = await getIdTokenSafe(attempt === 0 ? false : true);
      const finalHeaders = {
        "Content-Type": "application/json",
        ...headers,
      };
      if (authToken) finalHeaders["Authorization"] = `Bearer ${authToken}`;
      if (requireAuth && !authToken) {
        throw new Error("Not authenticated");
      }

      const resp = await fetch(url, {
        method,
        headers: finalHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(t);

      let data = null;
      try { data = await resp.json(); } catch (_) { data = null; }

      if (!resp.ok) {
        const msg = (data && (data.error || data.message)) || `HTTP ${resp.status}`;
        const err = new Error(msg);
        err.status = resp.status;
        throw err;
      }
      return data;
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      if (attempt === retries) break;
      await sleep(400 * (attempt + 1));
    }
  }
  throw lastErr || new Error("Request failed");
}

export const apiClient = {
  get: (url, opts) => request("GET", url, undefined, opts),
  post: (url, body, opts) => request("POST", url, body, opts),
  put: (url, body, opts) => request("PUT", url, body, opts),
  del: (url, opts) => request("DELETE", url, undefined, opts),
};

export default apiClient;


