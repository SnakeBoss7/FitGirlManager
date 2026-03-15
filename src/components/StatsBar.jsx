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
  if (!seconds) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function StatsBar({ stats }) {
  const { done, total, failed, bytesDone, elapsed, speed } = stats
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const statItems = [
    {
      label: 'Progress',
      value: `${done}/${total}`,
      sub: `${pct}%`,
      color: 'text-emerald-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'Downloaded',
      value: fmt(bytesDone),
      color: 'text-blue-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
    },
    {
      label: 'Speed',
      value: fmtSpeed(speed),
      color: 'text-violet-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: 'Time',
      value: fmtTime(elapsed),
      color: 'text-amber-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="animate-fade-up space-y-3">
      {/* Overall progress bar */}
      <div className="glass-card !rounded-xl !p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse-dot" />
            <span className="text-xs font-semibold text-slate-300">Downloading</span>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {done}/{total} files · {pct}%
            {failed > 0 && <span className="text-red-400 ml-2">{failed} failed</span>}
          </span>
        </div>
        <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-400 transition-all duration-700 ease-out progress-glow"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statItems.map(stat => (
          <div key={stat.label} className="stat-card flex items-center gap-2.5">
            <div className={`shrink-0 ${stat.color}`}>{stat.icon}</div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{stat.label}</p>
              <div className="flex items-baseline gap-1.5">
                <p className={`text-sm font-bold font-mono ${stat.color}`}>{stat.value}</p>
                {stat.sub && <span className="text-[10px] text-slate-500">{stat.sub}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
