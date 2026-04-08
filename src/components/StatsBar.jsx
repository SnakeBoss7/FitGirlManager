function fmt(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(2) + ' GB'
}

function fmtSpeed(bps) {
  if (!bps) return '—'
  return fmt(bps) + '/s'
}

function fmtTime(seconds) {
  if (!seconds || seconds <= 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function calcETA(bytesDone, speed, bytesTotal) {
  if (!speed || !bytesTotal || bytesDone >= bytesTotal) return null
  const remaining = bytesTotal - bytesDone
  return Math.ceil(remaining / speed)
}

export default function StatsBar({ stats, paused }) {
  const { done, total, failed, bytesDone, bytesTotal, elapsed, speed } = stats
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  // ETA based on total remaining bytes across all files (not just current file)
  const eta = calcETA(bytesDone, speed, bytesTotal)

  const statItems = [
    {
      label: 'Progress',
      value: `${done}/${total}`,
      sub: `${pct}%`,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'Downloaded',
      value: fmt(bytesDone),
      sub: bytesTotal > 0 ? `/ ${fmt(bytesTotal)}` : undefined,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
    },
    {
      label: paused ? 'Paused' : 'Speed',
      value: paused ? '—' : fmtSpeed(speed),
      color: paused ? 'text-amber-400' : 'text-violet-400',
      bg: paused ? 'bg-amber-500/10' : 'bg-violet-500/10',
      icon: paused ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: eta && !paused ? 'ETA' : 'Elapsed',
      value: eta && !paused ? fmtTime(eta) : fmtTime(elapsed),
      color: eta && !paused ? 'text-amber-300' : 'text-amber-400',
      bg: 'bg-amber-500/10',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="animate-fade-up space-y-2.5">
      {/* Overall progress bar */}
      <div className="glass-card !rounded-xl !p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            {paused ? (
              <div className="w-2 h-2 rounded-full bg-amber-400" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse-dot" />
            )}
            <span className="text-xs font-semibold text-slate-300">
              {paused ? 'Paused' : 'Downloading'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 tabular-nums">
            <span>{done}/{total} files · {pct}%</span>
            {failed > 0 && (
              <span className="text-red-400 font-semibold bg-red-500/10 px-2 py-0.5 rounded-full">
                {failed} failed
              </span>
            )}
          </div>
        </div>
        {/* Track */}
        <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              paused
                ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                : 'bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-400 progress-glow'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statItems.map(stat => (
          <div key={stat.label} className="stat-card flex items-center gap-2.5">
            <div className={`shrink-0 p-1.5 rounded-lg ${stat.bg} ${stat.color}`}>
              {stat.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{stat.label}</p>
              <div className="flex items-baseline gap-1">
                <p className={`text-sm font-bold font-mono tabular-nums ${stat.color}`}>{stat.value}</p>
                {stat.sub && <span className="text-[10px] text-slate-500">{stat.sub}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
