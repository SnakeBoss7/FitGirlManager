import { useState } from 'react'

export default function UrlInput({ onScrape, loading, settings, onSettingsChange }) {
  const [url, setUrl] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    onScrape(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-0">
      {/* URL Row */}
      <div className="flex gap-2.5">
        <div className="flex-1 relative group">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <input
            id="fitgirl-url-input"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://fitgirl-repacks.site/your-game/"
            required
            disabled={loading}
            className="w-full bg-[#0d0f1a]/80 border border-indigo-500/10 rounded-xl pl-10 pr-4 py-3
              text-slate-100 placeholder:text-slate-600 text-sm font-mono-tight
              focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/30
              disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200
              hover:border-indigo-500/20"
          />
        </div>

        <button
          id="scrape-btn"
          type="submit"
          disabled={loading}
          className="btn-glow shrink-0 flex items-center gap-2 text-sm"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scraping…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scrape
            </>
          )}
        </button>

        {/* Settings toggle */}
        <button
          type="button"
          onClick={() => setShowSettings(s => !s)}
          className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border transition-all duration-200
            ${showSettings
              ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
              : 'bg-transparent border-indigo-500/10 text-slate-500 hover:text-slate-300 hover:border-indigo-500/20'
            }`}
        >
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Collapsible Settings Panel */}
      <div className={`overflow-hidden transition-all duration-300 ease-out ${showSettings ? 'max-h-40 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-1 pt-3 border-t border-white/[0.04]">
          {/* Hoster */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Hoster</span>
            <select value={settings.hoster} onChange={e => onSettingsChange({ ...settings, hoster: e.target.value })}
              className="bg-[#0d0f1a] border border-indigo-500/10 rounded-lg px-2.5 py-1.5 text-sm text-slate-300
                focus:outline-none focus:border-violet-500/30 cursor-pointer transition-all hover:border-indigo-500/20">
              <option value="fuckingfast">FuckingFast</option>
              <option value="datanodes">DataNodes</option>
            </select>
          </div>

          {/* Checkboxes */}
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none">
            <input type="checkbox" checked={settings.includeLang} onChange={e => onSettingsChange({ ...settings, includeLang: e.target.checked })}
              className="custom-check" />
            Language Packs
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none">
            <input type="checkbox" checked={settings.includeOptional} onChange={e => onSettingsChange({ ...settings, includeOptional: e.target.checked })}
              className="custom-check" />
            Optional Files
          </label>

          {/* Concurrent */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Threads</span>
            <input type="number" min="1" max="10" value={settings.concurrent}
              onChange={e => onSettingsChange({ ...settings, concurrent: parseInt(e.target.value) || 1 })}
              className="w-14 bg-[#0d0f1a] border border-indigo-500/10 rounded-lg px-2 py-1.5 text-center text-sm text-slate-300
                font-mono focus:outline-none focus:border-violet-500/30 transition-all hover:border-indigo-500/20" />
          </div>

          {/* Order */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Order</span>
            <select value={settings.order} onChange={e => onSettingsChange({ ...settings, order: e.target.value })}
              className="bg-[#0d0f1a] border border-indigo-500/10 rounded-lg px-2.5 py-1.5 text-sm text-slate-300
                focus:outline-none focus:border-violet-500/30 cursor-pointer transition-all hover:border-indigo-500/20">
              <option value="top_down">Top → Bottom</option>
              <option value="bottom_up">Bottom → Top</option>
            </select>
          </div>
        </div>
      </div>
    </form>
  )
}
