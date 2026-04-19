import { API_BASES } from "./config";

const REQUEST_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Helper: Create a fetch with timeout + detailed error classification
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const existingSignal = options.signal;

  // Merge abort signals if one already exists
  if (existingSignal) {
    existingSignal.addEventListener("abort", () => controller.abort());
  }

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);

    if (err.name === "AbortError") {
      if (existingSignal?.aborted) throw err; // user-initiated abort
      throw new Error(
        `⏱️ Request timed out after ${timeoutMs / 1000}s. The backend at "${url}" may be sleeping or unreachable.`
      );
    }
    if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
      throw new Error(
        `🌐 Network error — could not reach the backend at "${url}". ` +
        `Check if the server is running and CORS is configured. (${err.message})`
      );
    }
    if (err.message?.includes("CORS") || err.message?.includes("cross-origin")) {
      throw new Error(
        `🚫 CORS error — the backend rejected the request. Make sure your frontend origin is listed in the backend's allow_origins.`
      );
    }
    throw new Error(`❌ Request failed: ${err.message}`);
  }
}

let activeApiBase = null; // Cache the resolved good base once

/** Reset the cached active base — forces re-probe on next request */
export function resetActiveBase() {
  activeApiBase = null;
}

/**
 * Helper: Try fetching across all available API bases
 */
async function fetchWithFailover(path, options = {}, timeoutMs = REQUEST_TIMEOUT_MS, isHealthCheck = false) {
  let lastError;
  let lastResponse;

  // Prioritize known working base if we have one
  const basesToTry = activeApiBase && !isHealthCheck
    ? [activeApiBase] // Lock onto the working base, do not failover to dead ones!
    : API_BASES;

  for (const base of basesToTry) {

    const url = base ? `${base}${path}` : path;
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);

      // If the response is OK, or if it's a 4xx client error, return it immediately
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        if (!activeApiBase) activeApiBase = base;
        return res;
      }

      // If it's a 5xx server error, try the next base
      if (res.status >= 500) {
        lastResponse = res;
        console.warn(`[API] Server error (${res.status}) at ${url}, trying next fallback...`);
        continue;
      }

      if (!activeApiBase) activeApiBase = base;
      return res;
    } catch (err) {
      lastError = err;
      if (err.name === "AbortError" && options.signal?.aborted) {
        throw err; // user explicitly aborted, do not retry
      }
      console.warn(`[API] Failed to reach ${url}, trying next fallback...`, err.message);
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error("All backend connection attempts failed.");
}

/**
 * Check backend health — useful for diagnosing connection issues.
 * @returns {Promise<{ ok: boolean, latencyMs: number, error?: string }>}
 */
export async function checkBackendHealth() {
  const start = Date.now();
  try {
    const res = await fetchWithFailover('/api/health', { method: "GET" }, 15_000, true);
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { ok: false, latencyMs, error: `Server returned HTTP ${res.status}` };
    }
    const data = await res.json();
    return { 
      ok: data.status === "ok", 
      latencyMs, 
      error: data.status !== "ok" ? "Unexpected response" : undefined,
      connectedBase: activeApiBase
    };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message };
  }
}

/**
 * POST /api/scrape — fetch and parse a FitGirl repacks page.
 * @param {string} url - The full FitGirl repacks page URL
 * @returns {Promise<ScrapeResponse>}
 */
export async function scrape(url) {
  const res = await fetchWithFailover(`/api/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Scrape failed (HTTP ${res.status})`);
  }
  return res.json();
}

export function buildProxyUrl(fileUrl, filename, attempt = 0) {
  let base = activeApiBase !== null ? activeApiBase : (API_BASES[0] || '');

  // If the active base fails (attempt > 0), force rotation to fallback instances
  if (attempt > 0 && API_BASES.length > 1) {
    base = API_BASES[attempt % API_BASES.length];
  }

  return `${base}/api/proxy?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}`;
}

/**
 * Download a file through the proxy with automatic backend failover.
 * Tries every backend in API_BASES before giving up.
 * Returns the successful Response object.
 */
export async function fetchProxyWithFailover(fileUrl, filename, signal) {
  let lastError;

  for (let i = 0; i < API_BASES.length; i++) {
    const base = API_BASES[i] || '';
    const url = `${base}/api/proxy?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}`;

    try {
      const res = await fetch(url, { signal });

      // 2xx — great, lock onto this backend
      if (res.ok) {
        activeApiBase = base;
        return res;
      }

      // 4xx — client error, no point retrying a different backend
      if (res.status >= 400 && res.status < 500) {
        return res;
      }

      // 5xx — server error, try next backend
      console.warn(`[Proxy] ${res.status} from ${base}, trying next backend...`);
      lastError = new Error(`HTTP ${res.status} from ${base}`);
      continue;
    } catch (err) {
      // User aborted — do not retry
      if (signal?.aborted || err.name === 'AbortError') throw err;

      console.warn(`[Proxy] Failed to reach ${base}:`, err.message);
      lastError = err;
    }
  }

  // All backends exhausted
  activeApiBase = null; // force re-probe next time
  throw lastError || new Error('All backends unreachable for proxy download');
}

/**
 * POST /api/resolve — batch resolve redirect URLs (e.g. fuckingfast.co -> /dl/ direct link)
 * @param {string[]} urls - List of hoster URLs to resolve
 * @returns {Promise<{ resolved: Record<string, string|null> }>}
 */
export async function preresolve(urls) {
  const res = await fetchWithFailover(`/api/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  }, 120_000);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Resolution failed (HTTP ${res.status})`);
  }
  return res.json();
}
