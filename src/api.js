/**
 * Thin API wrappers for communicating with the FastAPI backend.
 */

const BASE = "/api";

/**
 * POST /api/scrape — fetch and parse a FitGirl repacks page.
 * @param {string} url - The full FitGirl repacks page URL
 * @returns {Promise<ScrapeResponse>}
 */
export async function scrape(url) {
  const res = await fetch(`${BASE}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Scrape failed");
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
