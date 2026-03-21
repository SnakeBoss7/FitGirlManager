import { API_BASE } from "./config";

const BASE = API_BASE ? `${API_BASE}/api` : "/api";
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

    // Classify the error for clear user feedback
    if (err.name === "AbortError") {
      if (existingSignal?.aborted) throw err; // user-initiated abort
      throw new Error(
        `⏱️ Request timed out after ${timeoutMs / 1000}s. The backend at "${API_BASE || 'localhost'}" may be sleeping or unreachable.`
      );
    }
    if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
      throw new Error(
        `🌐 Network error — could not reach the backend at "${API_BASE || 'localhost'}". ` +
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

/**
 * Check backend health — useful for diagnosing connection issues.
 * @returns {Promise<{ ok: boolean, latencyMs: number, error?: string }>}
 */
export async function checkBackendHealth() {
  const url = API_BASE ? `${API_BASE}/api/health` : "/api/health";
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(url, { method: "GET" }, 15_000);
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { ok: false, latencyMs, error: `Server returned HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: data.status === "ok", latencyMs, error: data.status !== "ok" ? "Unexpected response" : undefined };
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
  console.log(`[API] Scraping: ${url} → ${BASE}/scrape`);
  const start = Date.now();

  const res = await fetchWithTimeout(`${BASE}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  console.log(`[API] Scrape response: ${res.status} in ${Date.now() - start}ms`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Scrape failed (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Open an SSE connection to POST /api/download/stream.
 * Returns an EventSource-like interface using fetch + ReadableStream.
 * @param {Object} payloadReq - The full payload { queue, max_concurrent } or array mapping backwards compat
 * @param {string|null} downloadDir - Optional override download directory
 * @param {{ onProgress, onDone, onError, onComplete }} callbacks
 * @returns {{ close: () => void }} - Object with a close() method to abort
 */
export function startDownloadStream(payloadReq, downloadDir, callbacks) {
  const controller = new AbortController()

  ;(async () => {
    try {
      // allow fallback to array for backward compatibility
      const bodyPayload = Array.isArray(payloadReq) ? { queue: payloadReq } : { ...payloadReq }
      if (downloadDir) bodyPayload.download_dir = downloadDir

      console.log(`[API] Starting download stream → ${BASE}/download/stream`);
      const res = await fetch(`${BASE}/download/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop(); // keep incomplete last chunk

        for (const part of parts) {
          if (!part.trim() || part.startsWith(":")) continue; // keep-alive
          const lines = part.split("\n");
          let event = "message";
          let data = null;
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            if (line.startsWith("data:")) data = line.slice(5).trim();
          }
          if (!data) continue;
          const payload = JSON.parse(data);
          if (event === "progress" && callbacks.onProgress) callbacks.onProgress(payload);
          if (event === "done" && callbacks.onDone) callbacks.onDone(payload);
          if (event === "error" && callbacks.onError) callbacks.onError(payload);
          if (event === "complete" && callbacks.onComplete) callbacks.onComplete(payload);
        }
      }
    } catch (e) {
      if (e.name !== "AbortError" && callbacks.onError) {
        callbacks.onError({ error: e.message });
      }
    }
  })();

  return { close: () => controller.abort() };
}
