import { memo } from 'react'

const STATUS_CONFIG = {
  pending:     { label: 'Ready',       dot: 'bg-slate-400 dark:bg-slate-500' },
  resolving:   { label: 'Resolving',   dot: 'bg-sky-500 animate-pulse' },
  downloading: { label: 'Downloading', dot: 'bg-violet-500 animate-pulse-dot' },
  done:        { label: 'Done',        dot: 'bg-emerald-500' },
  failed:      { label: 'Failed',      dot: 'bg-red-500' },
  skipped:     { label: 'Skipped',     dot: 'bg-slate-400' },
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

/**
 * Smartly renders a filename by highlighting the unique part (partXXX) 
 * and dimming the repetitive prefix.
 */
function SmartFilename({ filename, isDone }) {
  // Try to extract partNNN or similar patterns
  const partMatch = filename.match(/(.*?)(\.part\d+|part\d+)(.*)/i)
  
  if (partMatch) {
    const [, prefix, part, suffix] = partMatch
    // Shorten prefix: show only last meaningful segment
    const shortPrefix = prefix.length > 30 
      ? '…' + prefix.slice(-20) 
      : prefix
    return (
      <span className={isDone ? 'text-slate-400 dark:text-slate-600' : ''}>
        <span className="text-[var(--text-3)] text-[11px]">{shortPrefix}</span>
        <span className="part-num text-[12px]">{part}</span>
        <span className="text-[11px]">{suffix}</span>
      </span>
    )
  }
  
  // No part pattern — just show the filename, truncated
  return (
    <span className={`text-[12px] ${isDone ? 'text-slate-400 dark:text-slate-600' : 'text-[var(--text-1)]'}`}>
      {filename}
    </span>
  )
}

function FileRow({ item, progress, checked, onToggle, onRetry, style }) {
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
      className={`file-row ${checked ? 'selected' : ''} ${isDone ? 'is-done' : ''} animate-fade-up`}
      style={style}
    >
      {/* Progress background wash */}
      {isDownloading && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none transition-all duration-500"
          style={{
            background: `linear-gradient(90deg, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0.02) ${pct}%, transparent ${pct}%)`,
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

      {/* Index number */}
      <span className="text-[10px] font-mono font-semibold text-[var(--text-3)] w-5 shrink-0 text-right relative z-10 tabular-nums">
        {item.index}
      </span>

      {/* Hoster badge */}
      {hosterInfo && (
        <span className={`hoster-badge ${hosterInfo.cls} relative z-10 shrink-0`}>{hosterInfo.short}</span>
      )}

      {/* Filename + progress */}
      <div className="flex-1 min-w-0 relative z-10">
        <p className="font-mono-tight truncate leading-snug">
          <SmartFilename filename={item.filename} isDone={isDone} />
        </p>
        {isActive && (
          <div className="mt-0.5 flex items-center gap-2">
            <div className="flex-1 h-[3px] bg-[var(--separator)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out
                  ${isDone ? 'bg-emerald-500/80' : 'bg-gradient-to-r from-violet-500 to-purple-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--text-3)] font-mono tabular-nums w-8 text-right shrink-0">{pct}%</span>
            {progress?.bytesDone > 0 && progress?.total > 0 && (
              <span className="text-[9px] text-[var(--text-3)] tabular-nums shrink-0 hidden sm:inline">
                {fmt(progress.bytesDone)}/{fmt(progress.total)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Status / Retry */}
      <div className="relative z-10 shrink-0 flex items-center justify-end gap-1.5 w-20">
        {isFailed ? (
          <button
            onClick={e => { e.stopPropagation(); onRetry?.(item.index) }}
            className="text-[10px] font-bold px-2 py-1 rounded-md border border-red-500/25 bg-red-500/8 text-red-500 hover:bg-red-500/15 transition-all active:scale-95"
          >
            ↺ Retry
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
            <span className="text-[10px] font-semibold uppercase text-[var(--text-3)] tracking-wide whitespace-nowrap">{cfg.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(FileRow)
