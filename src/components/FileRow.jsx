const STATUS_CONFIG = {
  pending:     { label: 'Ready',       dot: 'bg-slate-400',   text: 'text-slate-400' },
  resolving:   { label: 'Resolving',   dot: 'bg-blue-400 animate-pulse',    text: 'text-blue-300' },
  downloading: { label: 'Downloading', dot: 'bg-violet-400 animate-pulse',  text: 'text-violet-300' },
  done:        { label: 'Complete',    dot: 'bg-emerald-400', text: 'text-emerald-300' },
  failed:      { label: 'Failed',      dot: 'bg-red-400',     text: 'text-red-300' },
  skipped:     { label: 'Skipped',     dot: 'bg-slate-500',   text: 'text-slate-500' },
}

function fmt(bytes) {
  if (!bytes || bytes < 0) return null
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(0) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(2) + ' GB'
}

export default function FileRow({ item, progress, checked, onToggle, onRetry, style }) {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending

  const pct = progress?.total && progress?.bytesDone >= 0
    ? Math.min(100, Math.round((progress.bytesDone / progress.total) * 100))
    : item.status === 'done' ? 100 : 0

  const isActive = item.status === 'downloading' || item.status === 'done'
  const isDone = item.status === 'done'
  const isFailed = item.status === 'failed'

  return (
    <div
      className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200
        animate-fade-up
        ${checked
          ? 'bg-white/[0.03] hover:bg-white/[0.05]'
          : 'bg-transparent hover:bg-white/[0.02]'
        }
        ${!checked && !isDone && !isFailed ? 'opacity-40' : ''}
        ${isDone ? 'opacity-60' : ''}
        ${isFailed ? 'opacity-90' : ''}
      `}
      style={style}
    >
      {/* Progress bar background (behind the row content) */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-xl transition-all duration-500 pointer-events-none"
          style={{
            background: isDone
              ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.04) 0%, transparent 100%)'
              : `linear-gradient(90deg, rgba(124, 58, 237, 0.06) 0%, rgba(124, 58, 237, 0.02) ${pct}%, transparent ${pct}%)`,
          }}
        />
      )}

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.index)}
        disabled={isDone || item.status === 'downloading'}
        className="custom-check !w-4 !h-4 relative z-10 shrink-0"
      />

      {/* Index */}
      <span className="text-[11px] font-mono text-slate-600 w-7 shrink-0 text-center relative z-10">
        {String(item.index).padStart(2, '0')}
      </span>

      {/* Filename + progress */}
      <div className="flex-1 min-w-0 relative z-10">
        <p className={`text-[13px] font-mono-tight truncate leading-tight ${isDone ? 'text-slate-400' : 'text-slate-200'}`}>
          {item.filename}
        </p>

        {isActive && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out
                  ${isDone
                    ? 'bg-emerald-500/60'
                    : 'bg-gradient-to-r from-violet-500 to-purple-400 progress-glow'
                  }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 font-mono w-8 text-right shrink-0">
              {pct}%
            </span>
            {progress?.bytesDone > 0 && progress?.total > 0 && (
              <span className="text-[10px] text-slate-600 shrink-0 hidden sm:inline">
                {fmt(progress.bytesDone)}/{fmt(progress.total)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="relative z-10 shrink-0 w-20 flex items-center justify-end gap-1.5">
        {isFailed ? (
          <button
            onClick={(e) => { e.stopPropagation(); onRetry?.(item.index) }}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg
              border border-red-500/20 bg-red-500/10 text-red-300
              hover:bg-red-500/20 hover:border-red-500/30
              transition-all duration-200 cursor-pointer active:scale-95"
          >
            Retry
          </button>
        ) : (
          <>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            <span className={`text-[11px] font-medium ${cfg.text}`}>{cfg.label}</span>
          </>
        )}
      </div>
    </div>
  )
}
