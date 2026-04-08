import { useState, useMemo } from 'react'
import FileRow from './FileRow'

export default function QueueTable({ items, progressMap, selected, onToggle, onToggleAll, onRetry, onRangeSelect }) {
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo,   setRangeTo]   = useState('')
  const [rangeErr,  setRangeErr]  = useState('')

  const eligibleItems = items.filter(i => i.status !== 'done' && i.status !== 'downloading')
  const allChecked    = eligibleItems.length > 0 && eligibleItems.every(i => selected.has(i.index))
  const someChecked   = items.some(i => selected.has(i.index))
  const selectedCount = items.filter(i => selected.has(i.index)).length
  const doneCount     = items.filter(i => i.status === 'done').length
  const failedCount   = items.filter(i => i.status === 'failed').length
  const dlCount       = items.filter(i => i.status === 'downloading').length

  // Extract common filename prefix for context display
  const commonPrefix = useMemo(() => {
    if (items.length < 2) return null
    const names = items.map(i => i.filename)
    let prefix = names[0]
    for (let i = 1; i < names.length; i++) {
      while (!names[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1)
        if (!prefix) return null
      }
    }
    return prefix.length > 10 ? prefix : null
  }, [items])

  function applyRange() {
    const from = parseInt(rangeFrom)
    const to   = parseInt(rangeTo)
    const min  = Math.min(...items.map(i => i.index))
    const max  = Math.max(...items.map(i => i.index))

    if (isNaN(from) || isNaN(to)) { setRangeErr('Enter valid numbers'); return }
    if (from > to)                { setRangeErr('From must be ≤ To');   return }
    if (from < min || to > max)   { setRangeErr(`Range: ${min}–${max}`); return }

    setRangeErr('')
    onRangeSelect(from, to)
  }

  return (
    <div className="flex flex-col">
      {/* ── Summary badges ── */}
      <div className="flex items-center gap-2 px-3 pb-3 flex-wrap">
        <div className="flex items-center gap-1.5 mr-auto">
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
            onChange={onToggleAll}
            className="custom-check shrink-0"
          />
          <span className="text-[11px] font-semibold text-[var(--text-3)]">Select All</span>
        </div>

        {/* Status summary pills */}
        {selectedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-500/10 text-violet-500 border border-violet-500/15 px-2 py-0.5 rounded-md">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>
            {selectedCount} selected
          </span>
        )}
        {doneCount > 0 && (
          <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/15 px-2 py-0.5 rounded-md">
            {doneCount} done
          </span>
        )}
        {dlCount > 0 && (
          <span className="text-[10px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/15 px-2 py-0.5 rounded-md animate-pulse">
            {dlCount} active
          </span>
        )}
        {failedCount > 0 && (
          <span className="text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/15 px-2 py-0.5 rounded-md">
            {failedCount} failed
          </span>
        )}
        <span className="text-[10px] text-[var(--text-3)] font-mono tabular-nums">
          {items.length} total
        </span>
      </div>

      {/* ── Common prefix context ── */}
      {commonPrefix && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-[var(--text-3)] font-mono truncate">
            <span className="text-[var(--text-3)] opacity-50">Prefix:</span> {commonPrefix}
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-[var(--separator)]" />

      {/* ── Scrollable file rows ── */}
      <div
        className="flex flex-col overflow-y-auto custom-scroll relative py-1"
        style={{ maxHeight: items.length > 12 ? '420px' : 'none' }}
      >
        {items.map((item, i) => (
          <FileRow
            key={item.index}
            item={item}
            progress={progressMap[item.index]}
            checked={selected.has(item.index)}
            onToggle={onToggle}
            onRetry={onRetry}
            style={{ animationDelay: `${Math.min(i * 8, 200)}ms` }}
          />
        ))}
      </div>

      {/* ── Range selector ── */}
      <div className="mt-3 pt-3 border-t border-[var(--separator)] flex flex-wrap items-center gap-2 px-3">
        <span className="text-[10px] text-[var(--text-3)] font-semibold uppercase tracking-widest shrink-0">Range</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            placeholder="From"
            value={rangeFrom}
            min={1}
            onChange={e => { setRangeFrom(e.target.value); setRangeErr('') }}
            className="w-14 h-6 input-field rounded-md px-2 text-center text-[11px] font-mono tabular-nums outline-none"
          />
          <span className="text-[var(--text-3)] text-xs">→</span>
          <input
            type="number"
            placeholder="To"
            value={rangeTo}
            min={1}
            onChange={e => { setRangeTo(e.target.value); setRangeErr('') }}
            className="w-14 h-6 input-field rounded-md px-2 text-center text-[11px] font-mono tabular-nums outline-none"
          />
        </div>
        <button type="button" onClick={applyRange} className="btn-ghost h-6 px-2.5 text-[10px]">
          Apply
        </button>
        <button type="button" onClick={() => { setRangeFrom(''); setRangeTo(''); onRangeSelect(null, null) }} className="btn-ghost h-6 px-2.5 text-[10px]">
          Clear
        </button>
        {rangeErr && (
          <span className="text-[10px] text-red-500 font-medium">{rangeErr}</span>
        )}
      </div>
    </div>
  )
}
