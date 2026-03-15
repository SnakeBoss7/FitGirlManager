import { useState, useRef, useCallback, useEffect } from 'react'
import UrlInput from './components/UrlInput'
import QueueTable from './components/QueueTable'
import StatsBar from './components/StatsBar'
import ToastContainer from './components/Toast'
import { useToast } from './hooks/useToast'
import { scrape } from './api'
import { API_BASE } from './config'

const INITIAL_STATS = {
  done: 0,
  total: 0,
  failed: 0,
  bytesDone: 0,
  bytesTotal: null,
  elapsed: 0,
  speed: null,
}

export default function App() {
  const [scrapeResult, setScrapeResult] = useState(() => {
    const saved = localStorage.getItem('fg_scrapeResult')
    return saved ? JSON.parse(saved) : null
  })
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('fg_queue')
    return saved ? JSON.parse(saved) : []
  })

  const [selected, setSelected] = useState(new Set())
  const [progressMap, setProgressMap] = useState({})
  const [scraping, setScraping] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [stats, setStats] = useState(INITIAL_STATS)
  const [settings, setSettings] = useState({
    includeLang: false,
    includeOptional: false,
    concurrent: 3,
    order: 'top_down',
    hoster: 'fuckingfast',
  })
  const { toasts, addToast, removeToast } = useToast()
  const abortControllerRef = useRef(null)
  const startTimeRef = useRef(null)
  const elapsedInterval = useRef(null)

  useEffect(() => {
    localStorage.setItem('fg_queue', JSON.stringify(items))
  }, [items])
  useEffect(() => {
    localStorage.setItem('fg_scrapeResult', JSON.stringify(scrapeResult))
  }, [scrapeResult])

  /* ─── SCRAPE ─── */
  async function handleScrape(url) {
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

      const toSelect = result.queue.filter(i => {
        if (i.status === 'failed') return false
        if (!settings.includeLang && i.isLanguage) return false
        if (!settings.includeOptional && i.isOptional) return false
        if (i.hoster !== result.hoster) return false
        return true
      }).map(i => i.index)

      setSettings(s => ({ ...s, hoster: result.hoster }))
      setSelected(new Set(toSelect))
      setStats(s => ({ ...s, total: result.queue.filter(i => i.hoster === result.hoster).length }))
      addToast(`Found ${result.queue.length} files for "${result.game}"`, 'success')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setScraping(false)
    }
  }

  /* ─── SELECTION ─── */
  const handleToggle = useCallback((index) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }, [])

  const handleToggleAll = useCallback(() => {
    setSelected(prev => {
      const eligible = items.filter(i => i.status !== 'done' && i.status !== 'downloading' && i.hoster === settings.hoster)
      const allChecked = eligible.every(i => prev.has(i.index))
      if (allChecked) return new Set()
      return new Set(eligible.map(i => i.index))
    })
  }, [items, settings.hoster])

  const handleRetry = useCallback((index) => {
    setItems(prev => prev.map(i => i.index === index ? { ...i, status: 'pending', retries: 0 } : i))
    setSelected(prev => new Set([...prev, index]))
  }, [])

  /* ─── DOWNLOAD ─── */
  const downloadFileMegaStyle = async (url, filename, index, prevBytesRef, prevTimeRef) => {
    const endpoint = API_BASE ? `${API_BASE}/api/proxy` : "/api/proxy"
    const res = await fetch(
      `${endpoint}?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
    )

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const total = parseInt(res.headers.get('content-length'), 10) || 0
    let loaded = 0

    const reader = res.body.getReader()
    const chunks = []

    while (true) {
      if (abortControllerRef.current.signal.aborted) {
        reader.cancel()
        throw new Error('Aborted')
      }

      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      loaded += value.length

      setProgressMap(prev => ({ ...prev, [index]: { bytesDone: loaded, total } }))

      const now = Date.now()
      const dt = (now - prevTimeRef.current) / 1000
      if (dt > 0.5) {
        setStats(s => ({
          ...s,
          bytesDone: s.bytesDone + (loaded - prevBytesRef.current),
          speed: Math.round((loaded - prevBytesRef.current) / dt),
        }))
        prevBytesRef.current = loaded
        prevTimeRef.current = now
      }
    }

    const blob = new Blob(chunks, { type: 'application/octet-stream' })
    const blobUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
  }

  async function handleStartDownload() {
    let queue = items.filter(i => selected.has(i.index) && i.status !== 'done' && i.hoster === settings.hoster)
    if (!queue.length) { addToast('No files selected.', 'warning'); return }

    if (settings.order === 'bottom_up') {
      queue = [...queue].reverse()
    }

    setDownloading(true)
    startTimeRef.current = Date.now()
    abortControllerRef.current = new AbortController()

    elapsedInterval.current = setInterval(() => {
      setStats(s => ({ ...s, elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000) }))
    }, 1000)

    let currentIndex = 0
    const prevBytesRef = { current: 0 }
    const prevTimeRef = { current: Date.now() }

    const runQueue = async () => {
      while (currentIndex < queue.length) {
        if (abortControllerRef.current.signal.aborted) break

        const item = queue[currentIndex++]

        setItems(old => old.map(i => i.index === item.index ? { ...i, status: 'downloading' } : i))

        let attempts = 0
        let success = false

        while (attempts < 3 && !success) {
          if (abortControllerRef.current.signal.aborted) break

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

    const workers = []
    const numWorkers = Math.min(settings.concurrent, queue.length)
    for (let i = 0; i < numWorkers; i++) {
      workers.push(runQueue())
    }

    await Promise.all(workers)

    clearInterval(elapsedInterval.current)
    setDownloading(false)
    if (!abortControllerRef.current.signal.aborted) {
      addToast('All downloads complete!', 'success', 6000)
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    clearInterval(elapsedInterval.current)
    setDownloading(false)
    addToast('Download cancelled', 'warning')
  }

  useEffect(() => () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    clearInterval(elapsedInterval.current)
  }, [])

  const filteredItems = items.filter(i => i.hoster === settings.hoster)
  const selectedCount = items.filter(i => selected.has(i.index) && i.hoster === settings.hoster).length

  /* ─── RENDER ─── */
  return (
    <div className="min-h-screen text-slate-100 relative">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -left-60 w-[500px] h-[500px] bg-violet-600/[0.07] rounded-full blur-[100px]" />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-indigo-600/[0.05] rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 w-[350px] h-[350px] bg-purple-600/[0.04] rounded-full blur-[100px]" />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 flex flex-col gap-6">

        {/* ── HEADER ── */}
        <header className="text-center space-y-3 mb-2">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-violet-400/80">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse-dot" />
            FitGirl Repack Manager
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gradient">
            Download Queue
          </h1>
          <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
            Paste a FitGirl Repacks URL to resolve download links and manage your queue.
          </p>
        </header>

        {/* ── URL INPUT ── */}
        <div className="glass-card p-4">
          <UrlInput
            onScrape={handleScrape}
            loading={scraping}
            settings={settings}
            onSettingsChange={setSettings}
          />
        </div>

        {/* ── SCRAPING SKELETON ── */}
        {scraping && (
          <div className="glass-card p-5 space-y-3 animate-fade-up">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-slate-300 font-medium">Scraping and resolving download links…</span>
            </div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="shimmer h-10 bg-white/[0.02] rounded-lg" style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </div>
        )}

        {/* ── GAME INFO BAR ── */}
        {scrapeResult && !scraping && (
          <div className="flex flex-wrap items-center gap-3 animate-fade-up">
            <h2 className="text-lg font-bold text-white truncate flex-1">{scrapeResult.game}</h2>
            <div className="flex gap-2 shrink-0">
              {scrapeResult.totalSizeEstimate && (
                <span className="text-[11px] bg-white/[0.04] border border-white/[0.06] text-slate-400 px-2.5 py-1 rounded-lg font-mono">
                  ~{scrapeResult.totalSizeEstimate}
                </span>
              )}
              <span className="text-[11px] bg-violet-500/10 border border-violet-500/15 text-violet-300 px-2.5 py-1 rounded-lg font-semibold">
                {scrapeResult.totalFiles} files
              </span>
            </div>
          </div>
        )}

        {/* ── STATS BAR ── */}
        {downloading && <StatsBar stats={stats} />}

        {/* ── QUEUE TABLE ── */}
        {filteredItems.length > 0 && !scraping && (
          <div className="glass-card p-4 space-y-3 animate-fade-up">
            <QueueTable
              items={filteredItems}
              progressMap={progressMap}
              selected={selected}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
              onRetry={handleRetry}
            />

            {/* Actions footer */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
              <p className="text-xs text-slate-500">
                <span className="text-slate-300 font-semibold">{selectedCount}</span>
                <span className="mx-1">/</span>
                <span className="font-medium">{filteredItems.length}</span> selected
              </p>
              <div className="flex gap-2.5">
                {downloading ? (
                  <button
                    id="cancel-btn"
                    onClick={handleCancel}
                    className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-300
                      text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-200
                      hover:bg-red-500/20 hover:border-red-500/30 active:scale-95"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </button>
                ) : (
                  <button
                    id="download-btn"
                    onClick={handleStartDownload}
                    disabled={selectedCount === 0}
                    className="btn-glow flex items-center gap-1.5 !text-xs !py-2 !px-5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download {selectedCount > 0 ? `(${selectedCount})` : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!items.length && !scraping && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-5 animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500/10 rounded-full blur-2xl scale-150" />
              <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-slate-500 text-sm font-medium">No files in queue</p>
              <p className="text-slate-600 text-xs">Paste a FitGirl URL above to get started</p>
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <footer className="text-center pt-4">
          <p className="text-[11px] text-slate-700">
            Built with FastAPI + React · Files stream through memory → browser downloads
          </p>
        </footer>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
