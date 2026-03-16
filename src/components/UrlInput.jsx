import { useState } from 'react'
import CustomSelect from './CustomSelect'

const HOSTER_OPTIONS = [
  { value: 'fuckingfast', label: 'FuckingFast' },
  { value: 'datanodes',   label: 'DataNodes'   },
]
const ORDER_OPTIONS = [
  { value: 'top_down',  label: 'Top → Bottom' },
  { value: 'bottom_up', label: 'Bottom → Top'  },
]

export default function UrlInput({ onScrape, loading, settings, onSettingsChange, downloading, onClear }) {
  const [url, setUrl] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const locked = downloading || loading

  function handleSubmit(e) {
    e.preventDefault()
    const t = url.trim()
    if (!t) return
    onScrape(t)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* URL row */}
      <div className="flex gap-2">
        <div className="flex-1 relative group">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-violet-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
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
            className="w-full h-10 pl-10 pr-4 text-[13.5px] font-mono-tight input-field rounded-xl"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary h-10 px-5 text-sm">
          {loading
            ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Scraping…</>
            : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>Scrape</>
          }
        </button>

        <button type="button" onClick={() => setShowSettings(s => !s)}
          title={locked ? 'Settings locked while downloading' : 'Settings'}
          className={`
            shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border
            transition-all duration-200
            ${showSettings
              ? 'bg-violet-500/10 border-violet-500/30 text-violet-500'
              : 'input-field text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }
            ${locked ? 'opacity-50' : ''}
          `}
        >
          <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </button>

        <button type="button" onClick={onClear}
          title="Clear cache and restart"
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border input-field text-red-500/80 hover:text-red-500 focus:border-red-500/30 transition-all duration-200"
        >
          <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Settings panel */}
      <div className={`overflow-hidden transition-[max-height,opacity] ease-out ${showSettings ? 'max-h-40 opacity-100 duration-300' : 'max-h-0 opacity-0 duration-200'}`}>
        <div className="pt-3 mt-3 border-t border-[var(--card-border)]">
          {locked && (
            <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-500/80 mb-2.5 font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              Settings locked during download
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Hoster</span>
              <CustomSelect value={settings.hoster} onChange={v => onSettingsChange({...settings, hoster:v})} options={HOSTER_OPTIONS} disabled={locked}/>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Order</span>
              <CustomSelect value={settings.order} onChange={v => onSettingsChange({...settings, order:v})} options={ORDER_OPTIONS} disabled={locked}/>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Threads</span>
              <input type="number" min="1" max="10" value={settings.concurrent} disabled={locked}
                onChange={e => onSettingsChange({...settings, concurrent: parseInt(e.target.value)||1})}
                className="w-14 h-8 px-2 text-center text-[13.5px] font-mono tabular-nums outline-none input-field rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"/>
            </div>
            <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer hover:text-slate-800 dark:hover:text-slate-100 transition-colors select-none">
              <input type="checkbox" checked={settings.includeLang} disabled={locked} onChange={e => onSettingsChange({...settings, includeLang:e.target.checked})} className="custom-check"/>
              Language Packs
            </label>
            <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer hover:text-slate-800 dark:hover:text-slate-100 transition-colors select-none">
              <input type="checkbox" checked={settings.includeOptional} disabled={locked} onChange={e => onSettingsChange({...settings, includeOptional:e.target.checked})} className="custom-check"/>
              Optional Files
            </label>
          </div>
        </div>
      </div>
    </form>
  )
}
