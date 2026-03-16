const STATUS_CONFIG = {
  pending:     { label: 'Ready',       dot: 'bg-slate-400 dark:bg-slate-500',           text: 'text-slate-500 dark:text-slate-400'   },
  resolving:   { label: 'Resolving',   dot: 'bg-sky-500 dark:bg-sky-400 animate-pulse', text: 'text-sky-600 dark:text-sky-300'     },
  downloading: { label: 'Downloading', dot: 'bg-violet-500 dark:bg-violet-400 animate-pulse-dot', text: 'text-violet-600 dark:text-violet-300' },
  done:        { label: 'Done',        dot: 'bg-emerald-500 dark:bg-emerald-400',       text: 'text-emerald-600 dark:text-emerald-400' },
  failed:      { label: 'Failed',      dot: 'bg-red-500 dark:bg-red-400',               text: 'text-red-600 dark:text-red-400'     },
  skipped:     { label: 'Skipped',     dot: 'bg-slate-400 dark:bg-slate-600',           text: 'text-slate-500 dark:text-slate-600'   },
}

const HOSTER_LABELS = {
  fuckingfast: { cls: 'hoster-ff', short: 'FF' },
  datanodes:   { cls: 'hoster-dn', short: 'DN' },
}

function fmt(bytes) {
  if (!bytes || bytes < 0) return null
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(0) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(2) + ' GB'
}

export default function FileRow({ item, progress, checked, onToggle, onRetry, style }) {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending
  const hosterInfo = HOSTER_LABELS[item.hoster]

  const pct = progress?.total && progress?.bytesDone >= 0
    ? Math.min(100, Math.round((progress.bytesDone / progress.total) * 100))
    : item.status === 'done' ? 100 : 0

  const isDone       = item.status === 'done'
  const isFailed     = item.status === 'failed'
  const isDownloading = item.status === 'downloading'
  const isActive     = isDownloading || isDone

  return (
    <div
      className={`
        group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl
        transition-all duration-200 animate-fade-up
        ${checked ? 'bg-indigo-50/50 dark:bg-white/[0.03]' : 'bg-transparent'}
        ${!checked && !isDone && !isFailed ? 'opacity-40' : ''}
        ${isDone ? 'opacity-50' : ''}
        hover:bg-indigo-50/80 dark:hover:bg-white/[0.04]
      `}
      style={style}
    >
      {/* Progress wash */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none transition-all duration-700"
          style={{
            background: isDone
              ? 'linear-gradient(90deg, rgba(16,185,129,0.06) 0%, transparent 60%)'
              : `linear-gradient(90deg, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0.02) ${pct}%, transparent ${pct}%)`,
          }}
        />
      )}

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.index)}
        disabled={isDone || isDownloading}
        className="custom-check relative z-10 shrink-0"
      />

      {/* Index */}
      <span className="text-[11px] font-mono font-medium text-slate-400 dark:text-slate-600 w-6 shrink-0 text-right relative z-10 tabular-nums leading-none">
        {item.index}
      </span>

      {/* Hoster badge */}
      {hosterInfo && (
        <span className={`hoster-badge ${hosterInfo.cls} relative z-10 shrink-0`}>{hosterInfo.short}</span>
      )}

      {/* Filename + progress */}
      <div className="flex-1 min-w-0 relative z-10">
        <p className={`text-[12.5px] font-mono-tight font-medium truncate leading-snug ${isDone ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
          {item.filename}
        </p>
        {isActive && (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-[2px] bg-indigo-500/10 dark:bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out
                  ${isDone ? 'bg-emerald-500/90' : 'bg-gradient-to-r from-violet-500 to-purple-400 progress-glow'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 font-mono tabular-nums w-8 text-right shrink-0">{pct}%</span>
            {progress?.bytesDone > 0 && progress?.total > 0 && (
              <span className="text-[10px] text-slate-400 tabular-nums shrink-0 hidden sm:inline">
                {fmt(progress.bytesDone)}/{fmt(progress.total)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Status / Retry */}
      <div className="relative z-10 shrink-0 flex items-center justify-end gap-1.5 w-[90px]">
        {isFailed ? (
          <button
            onClick={e => { e.stopPropagation(); onRetry?.(item.index) }}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 transition-all duration-150 active:scale-95"
          >
            ↺ Retry
          </button>
        ) : (
          <>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
            <span className={`text-[11px] font-semibold tracking-wide uppercase ${cfg.text} whitespace-nowrap`}>{cfg.label}</span>
          </>
        )}
      </div>
    </div>
  )
}
