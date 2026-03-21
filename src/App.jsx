import { useState, useRef, useCallback, useEffect } from 'react'
import UrlInput from './components/UrlInput'
import QueueTable from './components/QueueTable'
import StatsBar from './components/StatsBar'
import ToastContainer from './components/Toast'
import { useToast } from './hooks/useToast'
import { scrape, checkBackendHealth } from './api'
import { API_BASE } from './config'

const INITIAL_STATS = { done: 0, total: 0, failed: 0, bytesDone: 0, bytesTotal: null, elapsed: 0, speed: null }

export default function App() {
  const [scrapeResult, setScrapeResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fg_scrapeResult')) } catch { return null }
  })
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fg_queue')) || [] } catch { return [] }
  })
  const [theme, setTheme] = useState(() => localStorage.getItem('fg_theme') || 'dark')

  const [selected, setSelected]       = useState(new Set())
  const [progressMap, setProgressMap] = useState({})
  const [scraping, setScraping]       = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [backendStatus, setBackendStatus] = useState({ checked: false, ok: null, latencyMs: null, error: null, checking: true })
  const [stats, setStats]             = useState(INITIAL_STATS)
  const [settings, setSettings]       = useState({
    includeLang:     false,
    includeOptional: false,
    concurrent:      3,
    order:           'top_down',
    hoster:          'fuckingfast',
  })

  const activeSettingsRef  = useRef(settings)
  const abortControllerRef = useRef(null)
  const startTimeRef       = useRef(null)
  const elapsedInterval    = useRef(null)
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
    let cancelled = false;
    async function ping() {
      setBackendStatus(s => ({ ...s, checking: true }));
      console.log(`[Health] Pinging backend at: ${API_BASE || 'localhost (proxy)'}`);
      const result = await checkBackendHealth();
      if (cancelled) return;
      console.log(`[Health] Result:`, result);
      setBackendStatus({ checked: true, ok: result.ok, latencyMs: result.latencyMs, error: result.error || null, checking: false });
      if (!result.ok) {
        addToast(`Backend unreachable: ${result.error}`, 'error', 10000);
      }
    }
    ping();
    return () => { cancelled = true; };
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  function handleClearCache() {
    if (downloading) {
      addToast('Cannot clear cache while a download is running', 'warning')
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

      // Auto-select fuckingfast by default if available
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
    if (from === null || to === null) return // User clicked clear
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
  const downloadFileMegaStyle = async (url, filename, index, prevBytesRef, prevTimeRef) => {
    const endpoint = API_BASE ? `${API_BASE}/api/proxy` : '/api/proxy'
    const res = await fetch(`${endpoint}?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`, { signal: abortControllerRef.current.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const total  = parseInt(res.headers.get('content-length'), 10) || 0
    let loaded   = 0
    const reader = res.body.getReader()
    const chunks = []

    while (true) {
      if (abortControllerRef.current?.signal.aborted) { reader.cancel(); throw new Error('Aborted') }
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      loaded += value.length
      setProgressMap(prev => ({ ...prev, [index]: { bytesDone: loaded, total } }))

      const now = Date.now()
      const dt  = (now - prevTimeRef.current) / 1000
      if (dt > 0.5) {
        const delta = loaded - prevBytesRef.current
        setStats(s => ({ ...s, bytesDone: s.bytesDone + delta, bytesTotal: total > 0 ? total : s.bytesTotal, speed: Math.round(delta / dt) }))
        prevBytesRef.current = loaded; prevTimeRef.current = now
      }
    }

    const blob    = new Blob(chunks, { type: 'application/octet-stream' })
    const blobUrl = URL.createObjectURL(blob)
    const a       = document.createElement('a')
    a.href        = blobUrl; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
  }

  async function handleStartDownload() {
    const snap = { ...settings }
    activeSettingsRef.current = snap

    let queue = items.filter(i => selected.has(i.index) && i.status !== 'done' && i.hoster === snap.hoster)
    if (!queue.length) { addToast('No files selected.', 'warning'); return }
    if (snap.order === 'bottom_up') queue = [...queue].reverse()

    setDownloading(true)
    startTimeRef.current = Date.now()
    abortControllerRef.current = new AbortController()

    elapsedInterval.current = setInterval(() => {
      setStats(s => ({ ...s, elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000) }))
    }, 1000)

    let currentIndex = 0
    const prevBytesRef = { current: 0 }
    const prevTimeRef  = { current: Date.now() }

    const runQueue = async () => {
      while (currentIndex < queue.length) {
        if (abortControllerRef.current?.signal.aborted) break
        const item   = queue[currentIndex++]
        let attempts = 0
        let success  = false

        setItems(old => old.map(i => i.index === item.index ? { ...i, status: 'downloading' } : i))

        while (attempts < 3 && !success) {
          if (abortControllerRef.current?.signal.aborted) break
          try {
            await downloadFileMegaStyle(item.url, item.filename, item.index, prevBytesRef, prevTimeRef)
            setItems(old => old.map(i => i.index === item.index ? { ...i, status: 'done' } : i))
            setStats(s => ({ ...s, done: s.done + 1 }))
            success = true
          } catch (err) {
            attempts++
            if (err.message === 'Aborted') break
            if (attempts < 3) {
              setItems(old => old.map(i => i.index === item.index ? { ...i, retries: attempts } : i))
              await new Promise(r => setTimeout(r, 2000))
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
    await Promise.all(Array.from({ length: numWorkers }, () => runQueue()))

    clearInterval(elapsedInterval.current)
    setDownloading(false)
    if (!abortControllerRef.current?.signal.aborted) addToast('All downloads complete! 🎉', 'success', 6000)
  }

  function handleCancel() {
    abortControllerRef.current?.abort()
    clearInterval(elapsedInterval.current)
    setDownloading(false)
    setItems(prev => prev.map(i => i.status === 'downloading' ? { ...i, status: 'pending' } : i))
    setStats(s => ({ ...s, speed: null }))
    addToast('Download cancelled.', 'warning', 4000)
  }

  useEffect(() => () => { abortControllerRef.current?.abort(); clearInterval(elapsedInterval.current) }, [])

  const filteredItems = items.filter(i => i.hoster === settings.hoster)
  const selectedCount = items.filter(i => selected.has(i.index) && i.hoster === settings.hoster).length

  /* ─── RENDER ─────────────────────────────────── */
  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Background elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-[var(--ambient-purple)] to-transparent" />
      </div>

      {/* Theme toggle (Top Right Floating) */}
      <button 
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-[var(--card)] border border-[var(--card-border)] shadow-sm flex items-center justify-center text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--accent-dim)] transition-all"
        title="Toggle Light/Dark Theme"
      >
        {theme === 'dark' ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        )}
      </button>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 flex flex-col gap-5">
        
        {/* Backend Status Banner */}
        {backendStatus.checked && !backendStatus.ok && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-3 animate-fade-up">
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-400">Backend Unreachable</p>
              <p className="text-xs text-red-300/80 mt-0.5 break-words">{backendStatus.error}</p>
              <p className="text-[10px] text-red-300/50 mt-1 font-mono">Target: {API_BASE || 'localhost (vite proxy)'}</p>
            </div>
            <button
              onClick={async () => { setBackendStatus(s => ({ ...s, checking: true })); const r = await checkBackendHealth(); setBackendStatus({ checked: true, ok: r.ok, latencyMs: r.latencyMs, error: r.error || null, checking: false }); if (r.ok) addToast('Backend connected!', 'success'); }}
              disabled={backendStatus.checking}
              className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/20 transition-all disabled:opacity-50"
            >
              {backendStatus.checking ? 'Checking…' : 'Retry'}
            </button>
          </div>
        )}

        {backendStatus.checked && backendStatus.ok && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 flex items-center gap-2 animate-fade-up" style={{ animationDuration: '3s', animationFillMode: 'forwards', opacity: 1 }}>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400">Backend connected</span>
            <span className="text-[10px] text-emerald-400/50 font-mono ml-auto">{API_BASE || 'localhost'}</span>
          </div>
        )}

        {/* Header */}
        <header className="text-center space-y-2.5 mb-2">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-500">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse-dot" />
            FitGirl Manager
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gradient">Download Queue</h1>
        </header>

        {/* URL Input */}
        <div className="card p-4">
          <UrlInput onScrape={handleScrape} loading={scraping} settings={settings} onSettingsChange={setSettings} downloading={downloading} onClear={handleClearCache} />
        </div>

        {/* Scrape Result Info */}
        {scrapeResult && !scraping && (
          <div className="flex flex-wrap items-center gap-3 animate-fade-up px-1 py-1">
            <h2 className="text-base font-bold text-[var(--text-1)] truncate flex-1">{scrapeResult.game}</h2>
            <div className="flex gap-2 shrink-0">
              {scrapeResult.totalSizeEstimate && (
                <span className="text-[11px] font-mono bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-2)] px-2.5 py-1 rounded-md">
                  ~{scrapeResult.totalSizeEstimate}
                </span>
              )}
              <span className="text-[11px] font-bold bg-violet-100 text-violet-700 border border-violet-200 dark:bg-[var(--accent-dim)] dark:text-violet-300 dark:border-violet-500/20 px-2.5 py-1 rounded-md">
                {scrapeResult.totalFiles} files
              </span>
            </div>
          </div>
        )}

        {/* Scraping Loading Skeleton */}
        {scraping && (
          <div className="card p-5 space-y-3 animate-fade-up">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-violet-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              <span className="text-sm font-semibold text-[var(--text-2)] animate-pulse">Scraping links…</span>
            </div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="shimmer h-12 rounded-xl" style={{ animationDelay: `${i * 180}ms` }} />)}
            </div>
          </div>
        )}

        {/* Stats */}
        {downloading && <StatsBar stats={stats} />}

        {/* Queue Table */}
        {filteredItems.length > 0 && !scraping && (
           <div className="card px-2 py-4 sm:p-5 space-y-3 animate-fade-up">
            <QueueTable
              items={filteredItems}
              progressMap={progressMap}
              selected={selected}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
              onRetry={handleRetry}
              onRangeSelect={handleRangeSelect}
            />

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-[var(--card-border)] px-1 sm:px-2">
              <p className="text-xs text-[var(--text-3)]">
                <span className="text-[var(--text-1)] font-bold tabular-nums">{selectedCount}</span>
                <span className="mx-[3px] opacity-40">/</span>
                <span className="font-semibold tabular-nums">{filteredItems.length}</span>
              </p>
              <div className="flex gap-2.5">
                {downloading ? (
                  <button onClick={handleCancel} className="flex items-center gap-1.5 bg-red-100 text-red-600 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400 text-xs font-bold px-4 py-2 rounded-xl hover:bg-red-200 dark:hover:bg-red-500/20 active:scale-95 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg> Cancel
                  </button>
                ) : (
                  <button onClick={handleStartDownload} disabled={selectedCount === 0} className="btn-primary !text-xs !py-[9px] !px-5 gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download{selectedCount > 0 ? ` (${selectedCount})` : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
