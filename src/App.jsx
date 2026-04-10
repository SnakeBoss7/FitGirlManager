import { useState, useRef, useCallback, useEffect } from 'react'
import UrlInput from './components/UrlInput'
import QueueTable from './components/QueueTable'
import StatsBar from './components/StatsBar'
import ToastContainer from './components/Toast'
import { useToast } from './hooks/useToast'
import { scrape, checkBackendHealth, buildProxyUrl, preresolve } from './api'
import { API_BASES } from './config'


const INITIAL_STATS = { done: 0, total: 0, failed: 0, bytesDone: 0, bytesTotal: 0, elapsed: 0, speed: null }

// ─── Feature detection ────────────────────────────────────────────────────────
// showDirectoryPicker: pick a folder ONCE, then stream all files into it silently
const supportsDirPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window

// ─── Stream-to-disk helper ────────────────────────────────────────────────────
/**
 * Download a file.
 * - If dirHandle is provided (from showDirectoryPicker): streams directly to disk, ZERO dialogs
 * - Otherwise: accumulates chunks into a Blob and auto-triggers anchor-click download (also zero dialogs)
 *
 * @param {string} proxyUrl - proxy endpoint URL
 * @param {string} filename - desired filename
 * @param {AbortSignal} signal - abort signal
 * @param {Function} onProgress - (loaded, total) => void
 * @param {FileSystemDirectoryHandle|null} dirHandle - directory handle for direct-to-disk writes
 */
async function downloadFile(proxyUrl, filename, signal, onProgress, dirHandle) {
  const res = await fetch(proxyUrl, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const total = parseInt(res.headers.get('content-length'), 10) || 0
  let loaded = 0
  const reader = res.body.getReader()

  if (dirHandle) {
    // ── Direct-to-disk path (Chrome/Edge) — NO per-file dialog ──
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    try {
      while (true) {
        if (signal.aborted) { reader.cancel(); throw new Error('Aborted') }
        const { done, value } = await reader.read()
        if (done) break
        await writable.write(value)
        loaded += value.length
        onProgress(loaded, total)
      }
      await writable.close()
    } catch (err) {
      try { await writable.abort() } catch { /* ignore */ }
      throw err
    }
  } else {
    // ── Blob + auto-download fallback (all browsers) — NO dialog ──
    const chunks = []
    while (true) {
      if (signal.aborted) { reader.cancel(); throw new Error('Aborted') }
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.length
      onProgress(loaded, total)
    }
    const blob = new Blob(chunks, { type: 'application/octet-stream' })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
  }
}

// ─── Pause helper ─────────────────────────────────────────────────────────────
function waitWhilePaused(pausedRef) {
  if (!pausedRef.current) return Promise.resolve()
  return new Promise(resolve => {
    const check = () => { if (!pausedRef.current) resolve(); else setTimeout(check, 150) }
    check()
  })
}

export default function App() {
  const [scrapeResult, setScrapeResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fg_scrapeResult')) } catch { return null }
  })
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fg_queue')) || [] } catch { return [] }
  })
  const [theme, setTheme] = useState(() => localStorage.getItem('fg_theme') || 'dark')

  const [selected, setSelected]           = useState(new Set())
  const [progressMap, setProgressMap]     = useState({})
  const [scraping, setScraping]           = useState(false)
  const [downloading, setDownloading]     = useState(false)
  const [paused, setPaused]               = useState(false)
  const [backendStatus, setBackendStatus] = useState({ checked: false, ok: null, latencyMs: null, error: null, checking: true, connectedBase: null })
  const [stats, setStats]                 = useState(INITIAL_STATS)
  const [settings, setSettings]           = useState({
    includeLang:     false,
    includeOptional: false,
    concurrent:      3,
    order:           'top_down',
    hoster:          'fuckingfast',
  })

  const activeSettingsRef = useRef(settings)
  const abortControllerRef = useRef(null)
  const pausedRef = useRef(false)
  const startTimeRef = useRef(null)
  const elapsedInterval = useRef(null)
  // Tracks global bytes downloaded across all concurrent workers (accurate speed/ETA)
  const globalBytesRef = useRef(0)
  const prevSpeedSampleRef = useRef({ bytes: 0, time: Date.now() })

  const { toasts, addToast, removeToast } = useToast()

  // Persist state
  useEffect(() => { localStorage.setItem('fg_queue', JSON.stringify(items)) }, [items])
  useEffect(() => { localStorage.setItem('fg_scrapeResult', JSON.stringify(scrapeResult)) }, [scrapeResult])

  // Apply theme class to body
  useEffect(() => {
    localStorage.setItem('fg_theme', theme)
    if (theme === 'dark') document.body.classList.add('dark')
    else document.body.classList.remove('dark')
  }, [theme])

  // Health check on mount
  useEffect(() => {
    let cancelled = false
    async function ping() {
      setBackendStatus(s => ({ ...s, checking: true }))
      const result = await checkBackendHealth()
      if (cancelled) return
      setBackendStatus({ checked: true, ok: result.ok, latencyMs: result.latencyMs, error: result.error || null, checking: false, connectedBase: result.connectedBase })
      if (!result.ok) addToast(`Backend unreachable: ${result.error}`, 'error', 10000)
    }
    ping()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  function handleClearCache() {
    if (downloading || scraping) {
      addToast('Cannot clear cache while a download or scrape is running', 'warning')
      return
    }
    setScrapeResult(null)
    setItems([])
    setSelected(new Set())
    setProgressMap({})
    setStats(INITIAL_STATS)
    localStorage.removeItem('fg_scrapeResult')
    localStorage.removeItem('fg_queue')
    addToast('Cache cleared. Ready for a new URL.', 'success')
  }

  /* ─── SCRAPE ─────────────────────────────────── */
  async function handleScrape(url) {
    if (downloading) addToast('A download is running. Scraping will not interrupt it.', 'warning', 5000)

    setScraping(true)
    setScrapeResult(null)
    setItems([])
    setSelected(new Set())
    setProgressMap({})
    setStats(INITIAL_STATS)

    try {
      const result = await scrape(url)
      setScrapeResult(result)
      setItems(result.queue)

      const hasFF = result.queue.some(i => i.hoster === 'fuckingfast')
      const targetHoster = hasFF ? 'fuckingfast' : result.hoster

      const s = settings
      const toSelect = result.queue.filter(i => {
        if (i.status === 'failed') return false
        if (!s.includeLang     && i.isLanguage) return false
        if (!s.includeOptional && i.isOptional) return false
        if (i.hoster !== targetHoster) return false
        return true
      }).map(i => i.index)

      setSettings(prev => ({ ...prev, hoster: targetHoster }))
      setSelected(new Set(toSelect))
      setStats(prev => ({ ...prev, total: result.queue.filter(i => i.hoster === targetHoster).length }))
      addToast(`Found ${result.queue.length} files (${targetHoster} selected)`, 'success')

      // ─── Pre-resolve URLs in background ───
      const ffUrls = result.queue.filter(i => i.hoster === 'fuckingfast' && !i.url.includes('/dl/')).map(i => i.url)
      if (ffUrls.length > 0) {
        // We don't 'await' here because we want the UI to be interactive while resolving
        preresolve(ffUrls).then(res => {
          setItems(prev => prev.map(item => {
            const resolved = res.resolved[item.url]
            if (resolved) return { ...item, url: resolved }
            return item
          }))
          const resolvedCount = Object.values(res.resolved).filter(Boolean).length
          if (resolvedCount > 0) addToast(`Resolved ${resolvedCount} direct links in background.`, 'success', 3000)
        }).catch(err => console.error('[Resolution] failed:', err))
      }

    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setScraping(false)
    }
  }

  /* ─── SELECTION ──────────────────────────────── */
  const handleToggle = useCallback((index) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }, [])

  const handleToggleAll = useCallback(() => {
    setSelected(prev => {
      const hoster = activeSettingsRef.current.hoster || settings.hoster
      const eligible = items.filter(i => i.status !== 'done' && i.status !== 'downloading' && i.hoster === hoster)
      const allChecked = eligible.every(i => prev.has(i.index))
      if (allChecked) return new Set()
      return new Set(eligible.map(i => i.index))
    })
  }, [items, settings.hoster])

  const handleRetry = useCallback((index) => {
    setItems(prev => prev.map(i => i.index === index ? { ...i, status: 'pending', retries: 0 } : i))
    setSelected(prev => new Set([...prev, index]))
  }, [])

  const handleRangeSelect = useCallback((from, to) => {
    if (from === null || to === null) return
    setSelected(prev => {
      const next = new Set(prev)
      const hoster = activeSettingsRef.current.hoster || settings.hoster
      const eligible = items.filter(i => i.status !== 'done' && i.status !== 'downloading' && i.hoster === hoster)
      eligible.forEach(i => {
        if (i.index >= from && i.index <= to) next.add(i.index)
      })
      return next
    })
  }, [items, settings.hoster])

  /* ─── DOWNLOAD ───────────────────────────────── */
  async function handleStartDownload() {
    const snap = { ...settings }
    activeSettingsRef.current = snap

    let queue = items.filter(i => selected.has(i.index) && i.status !== 'done' && i.hoster === snap.hoster)
    if (!queue.length) { addToast('No files selected.', 'warning'); return }
    if (snap.order === 'bottom_up') queue = [...queue].reverse()

    // ── Pick a download directory ONCE (Chrome/Edge) ──
    // Falls back to blob+anchor if user cancels or browser doesn't support it
    let dirHandle = null
    if (supportsDirPicker) {
      try {
        dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
        addToast(`Saving to: ${dirHandle.name}/`, 'success', 4000)
      } catch {
        // User cancelled directory picker — fall back to browser Downloads folder
        addToast('No folder selected — files will download to your browser Downloads folder.', 'warning', 5000)
      }
    }

    setDownloading(true)
    setPaused(false)
    pausedRef.current = false
    startTimeRef.current = Date.now()
    abortControllerRef.current = new AbortController()
    globalBytesRef.current = 0
    prevSpeedSampleRef.current = { bytes: 0, time: Date.now() }

    setStats({ done: 0, total: queue.length, failed: 0, bytesDone: 0, bytesTotal: 0, elapsed: 0, speed: null })

    elapsedInterval.current = setInterval(() => {
      setStats(s => ({ ...s, elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000) }))
    }, 1000)

    // ── Shared work queue with proper sequential access ──
    let currentIndex = 0
    const getNextItem = () => {
      if (currentIndex < queue.length) return queue[currentIndex++]
      return null
    }

    const runWorker = async () => {
      while (true) {
        // Wait while paused before picking up the next file
        await waitWhilePaused(pausedRef)
        if (abortControllerRef.current?.signal.aborted) break

        const item = getNextItem()
        if (!item) break

        let attempts = 0
        let success = false

        setItems(old => old.map(i => i.index === item.index ? { ...i, status: 'downloading' } : i))

        // Per-file byte tracker for progress (always update to avoid double-counting)
        let fileBytesDone = 0

        const onProgress = (loaded, total) => {
          const delta = loaded - fileBytesDone
          fileBytesDone = loaded  // always update to keep delta accurate

          globalBytesRef.current += delta

          setProgressMap(prev => ({
            ...prev,
            [item.index]: { bytesDone: loaded, total }
          }))

          // Global speed: sample every 600ms
          const now = Date.now()
          const dt = (now - prevSpeedSampleRef.current.time) / 1000
          if (dt >= 0.6) {
            const bytesDelta = globalBytesRef.current - prevSpeedSampleRef.current.bytes
            const speed = Math.round(bytesDelta / dt)
            prevSpeedSampleRef.current = { bytes: globalBytesRef.current, time: now }
            setStats(s => ({
              ...s,
              bytesDone: globalBytesRef.current,
              bytesTotal: total > 0 && s.bytesTotal === 0 ? total * queue.length : Math.max(s.bytesTotal, globalBytesRef.current),
              speed,
            }))
          } else {
            setStats(s => ({ ...s, bytesDone: globalBytesRef.current }))
          }
        }

        // Retry loop with exponential backoff
        while (attempts < 3 && !success) {
          if (abortControllerRef.current?.signal.aborted) break
          try {
            const proxyUrl = buildProxyUrl(item.url, item.filename)
            await downloadFile(proxyUrl, item.filename, abortControllerRef.current.signal, onProgress, dirHandle)
            setItems(old => old.map(i => i.index === item.index ? { ...i, status: 'done' } : i))
            setStats(s => ({ ...s, done: s.done + 1 }))
            success = true
          } catch (err) {
            if (err.message === 'Aborted') {
              // Aborted by user — reset item to pending and stop this worker
              setItems(old => old.map(i => i.index === item.index && i.status === 'downloading' ? { ...i, status: 'pending' } : i))
              break
            }
            attempts++
            if (attempts < 3) {
              setItems(old => old.map(i => i.index === item.index ? { ...i, retries: attempts } : i))
              // Exponential backoff: 2s, 4s
              await new Promise(r => setTimeout(r, 2000 * attempts))
            } else {
              setItems(old => old.map(i => i.index === item.index ? { ...i, status: 'failed', retries: attempts } : i))
              setStats(s => ({ ...s, failed: s.failed + 1 }))
              addToast(`Failed: ${item.filename}`, 'error')
            }
          }
        }
      }
    }

    const numWorkers = Math.min(snap.concurrent, queue.length)
    await Promise.all(Array.from({ length: numWorkers }, () => runWorker()))

    clearInterval(elapsedInterval.current)
    setDownloading(false)
    setPaused(false)
    pausedRef.current = false
    if (!abortControllerRef.current?.signal.aborted) {
      addToast('All downloads complete! 🎉', 'success', 6000)
    }
  }

  function handlePause() {
    pausedRef.current = true
    setPaused(true)
    addToast('Download paused — current file(s) will finish, then queue will hold.', 'warning', 4000)
  }

  function handleResume() {
    pausedRef.current = false
    setPaused(false)
    addToast('Download resumed.', 'success', 3000)
  }

  function handleCancel() {
    abortControllerRef.current?.abort()
    clearInterval(elapsedInterval.current)
    setDownloading(false)
    setPaused(false)
    pausedRef.current = false
    setItems(prev => prev.map(i => i.status === 'downloading' ? { ...i, status: 'pending' } : i))
    setStats(s => ({ ...s, speed: null }))
    addToast('Download cancelled.', 'warning', 4000)
  }

  useEffect(() => () => { abortControllerRef.current?.abort(); clearInterval(elapsedInterval.current) }, [])

  const filteredItems = items.filter(i => i.hoster === settings.hoster)
  const selectedCount = items.filter(i => selected.has(i.index) && i.hoster === settings.hoster).length

  const hasResults = filteredItems.length > 0 && !scraping
  const showEmptyState = !scrapeResult && !scraping

  /* ─── RENDER ─────────────────────────────────── */
  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[var(--ambient-glow)] via-[var(--ambient-blue)] to-transparent" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-[var(--ambient-glow)] to-transparent opacity-30" />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 w-9 h-9 rounded-xl bg-[var(--card)] border border-[var(--card-border)] flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:border-[var(--accent-dim)] transition-all"
        title="Toggle Theme"
      >
        {theme === 'dark' ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        )}
      </button>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-4 flex-1 w-full">

        {/* Backend Status */}
        {backendStatus.checked && !backendStatus.ok && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-2.5 flex items-center gap-3 animate-fade-up text-sm">
            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-red-400 text-xs">Backend offline</span>
              <span className="text-red-300/60 text-[10px] ml-2 font-mono">{API_BASES[0] || 'localhost'}</span>
            </div>
            <button
              onClick={async () => {
                setBackendStatus(s => ({ ...s, checking: true }))
                const r = await checkBackendHealth()
                setBackendStatus({ checked: true, ok: r.ok, latencyMs: r.latencyMs, error: r.error || null, checking: false, connectedBase: r.connectedBase })
                if (r.ok) addToast('Backend connected!', 'success')
              }}
              disabled={backendStatus.checking}
              className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/15 transition-all disabled:opacity-50"
            >
              {backendStatus.checking ? '…' : 'Retry'}
            </button>
          </div>
        )}
        {backendStatus.checked && backendStatus.ok && (
          <BackendOkBanner latencyMs={backendStatus.latencyMs} apiBase={backendStatus.connectedBase} />
        )}

        {/* Header */}
        <header className="text-center space-y-1.5 pt-2">
          <div className="inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.25em] text-violet-500/80">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            FitGirl Manager
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gradient">Download Queue</h1>
        </header>

        {/* URL Input Card */}
        <div className="card p-3.5">
          <UrlInput onScrape={handleScrape} loading={scraping} settings={settings} onSettingsChange={setSettings} downloading={downloading} onClear={handleClearCache} />
        </div>

        {/* ── EMPTY STATE ── */}
        {showEmptyState && (
          <div className="animate-fade-up space-y-4 py-6">
            <div className="text-center space-y-1.5 mb-6">
              <p className="text-sm font-semibold text-[var(--text-2)]">Get started in 3 steps</p>
              <p className="text-xs text-[var(--text-3)]">Paste a FitGirl Repacks URL and start downloading</p>
            </div>
            <div className="grid gap-3">
              <div className="empty-step" style={{ animationDelay: '50ms' }}>
                <div className="step-number">1</div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-1)]">Paste a Game URL</p>
                  <p className="text-xs text-[var(--text-3)] mt-0.5">Copy a link from fitgirl-repacks.site and paste it above</p>
                </div>
              </div>
              <div className="empty-step" style={{ animationDelay: '120ms' }}>
                <div className="step-number">2</div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-1)]">Select Your Files</p>
                  <p className="text-xs text-[var(--text-3)] mt-0.5">Pick which parts to download. Language packs and optionals can be toggled in settings.</p>
                </div>
              </div>
              <div className="empty-step" style={{ animationDelay: '190ms' }}>
                <div className="step-number">3</div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-1)]">Download</p>
                  <p className="text-xs text-[var(--text-3)] mt-0.5">Hit Download, pick a folder once, and all parts stream directly to disk. Pause and resume anytime.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SCRAPING SKELETON ── */}
        {scraping && (
          <div className="card p-5 space-y-3 animate-fade-up">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-violet-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              <span className="text-sm font-semibold text-[var(--text-2)] animate-pulse">Scraping download links…</span>
            </div>
            <div className="space-y-1.5">
              {[...Array(6)].map((_, i) => <div key={i} className="shimmer h-9" style={{ animationDelay: `${i * 150}ms` }} />)}
            </div>
          </div>
        )}

        {/* ── GAME INFO CARD ── */}
        {scrapeResult && !scraping && (
          <div className="game-card animate-fade-up">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-[var(--accent-soft)] uppercase tracking-wider mb-1">Game Found</p>
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-1)] leading-snug truncate">{scrapeResult.game}</h2>
              </div>
              <div className="flex gap-2 shrink-0">
                {scrapeResult.totalSizeEstimate && (
                  <div className="text-center px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--card-border)]">
                    <p className="text-[9px] font-semibold text-[var(--text-3)] uppercase tracking-wider">Size</p>
                    <p className="text-sm font-bold font-mono tabular-nums text-[var(--text-1)]">~{scrapeResult.totalSizeEstimate}</p>
                  </div>
                )}
                <div className="text-center px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--card-border)]">
                  <p className="text-[9px] font-semibold text-[var(--text-3)] uppercase tracking-wider">Files</p>
                  <p className="text-sm font-bold font-mono tabular-nums text-violet-500">{scrapeResult.totalFiles}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DOWNLOAD STATS ── */}
        {downloading && <StatsBar stats={stats} paused={paused} />}

        {/* ── QUEUE TABLE ── */}
        {hasResults && (
          <div className="card px-3 py-4 sm:p-4 animate-fade-up">
            <QueueTable
              items={filteredItems}
              progressMap={progressMap}
              selected={selected}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
              onRetry={handleRetry}
              onRangeSelect={handleRangeSelect}
            />
          </div>
        )}

        {/* ── ACTION BAR ── */}
        {hasResults && (
          <div className="sticky bottom-4 z-30 animate-fade-up">
            <div className="card !rounded-2xl px-4 py-3 flex items-center justify-between border-[var(--accent-dim)] shadow-lg shadow-violet-500/5">
              <p className="text-xs text-[var(--text-3)]">
                <span className="text-[var(--text-1)] font-bold tabular-nums text-sm">{selectedCount}</span>
                <span className="mx-1">/</span>
                <span className="font-semibold tabular-nums">{filteredItems.length}</span>
                <span className="ml-1.5 hidden sm:inline">selected</span>
              </p>
              <div className="flex gap-2">
                {downloading ? (
                  <>
                    {paused ? (
                      <button onClick={handleResume} className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold px-4 py-2 rounded-xl hover:bg-emerald-500/20 active:scale-95 transition-all">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        Resume
                      </button>
                    ) : (
                      <button onClick={handlePause} className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-500/20 active:scale-95 transition-all">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        Pause
                      </button>
                    )}
                    <button onClick={handleCancel} className="flex items-center gap-1.5 bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold px-4 py-2 rounded-xl hover:bg-red-500/20 active:scale-95 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={handleStartDownload} disabled={selectedCount === 0} className="btn-primary !text-xs !py-2 !px-5 gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download{selectedCount > 0 ? ` (${selectedCount})` : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 mt-auto">
        <p className="text-[10px] text-[var(--text-3)] opacity-50">
          FitGirl Manager · Built for speed
        </p>
      </footer>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

// ─── Auto-hiding backend OK banner ────────────────────────────────────────────
function BackendOkBanner({ latencyMs, apiBase }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [])
  if (!visible) return null
  return (
    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/6 px-4 py-2 flex items-center gap-2 animate-fade-up">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-[11px] font-semibold text-emerald-500">Connected</span>
      {latencyMs && <span className="text-[10px] text-emerald-500/40 font-mono">{latencyMs}ms</span>}
      <span className="text-[10px] text-emerald-500/30 font-mono ml-auto">{apiBase || 'localhost'}</span>
    </div>
  )
}
