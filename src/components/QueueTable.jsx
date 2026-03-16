import { useState } from 'react'
import FileRow from './FileRow'

export default function QueueTable({ items, progressMap, selected, onToggle, onToggleAll, onRetry, onRangeSelect }) {
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo,   setRangeTo]   = useState('')
  const [rangeErr,  setRangeErr]  = useState('')

  const eligibleItems = items.filter(i => i.status !== 'done' && i.status !== 'downloading')
  const allChecked    = eligibleItems.length > 0 && eligibleItems.every(i => selected.has(i.index))
  const someChecked   = items.some(i => selected.has(i.index))
  const selectedCount = items.filter(i => selected.has(i.index)).length

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
      {/* ── Header row ── */}
      <div className="flex items-center gap-3 px-3.5 pb-2 text-[10.5px] font-bold text-slate-500 tracking-widest uppercase select-none">
        <input
          type="checkbox"
          checked={allChecked}
          ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
          onChange={onToggleAll}
          className="custom-check shrink-0"
        />
        <span className="w-6 text-right shrink-0">#</span>
        <span className="w-6 shrink-0"></span>{/* hoster badge space */}
        <span className="flex-1">File</span>

        {selectedCount > 0 && (
          <span className="ml-auto mr-2 inline-flex items-center gap-1 text-[10px] font-bold bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-200 dark:border-violet-500/15 px-2 py-0.5 rounded-md">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>
            {selectedCount}
          </span>
        )}
        <span className="w-[90px] text-center hidden sm:block">Status</span>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-200 dark:bg-white/[0.06] mb-0.5" />

      {/* ── Scrollable file rows ── */}
      <div
        className="flex flex-col gap-0.5 overflow-y-auto custom-scroll relative"
        style={{ maxHeight: items.length > 14 ? '448px' : 'none' }}
      >
        {items.map((item, i) => (
          <FileRow
            key={item.index}
            item={item}
            progress={progressMap[item.index]}
            checked={selected.has(item.index)}
            onToggle={onToggle}
            onRetry={onRetry}
            style={{ animationDelay: `${Math.min(i * 12, 300)}ms` }}
          />
        ))}
      </div>

      {/* ── Range selector ── */}
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/[0.06] flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest shrink-0">Select Range</span>
        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="number"
            placeholder="From"
            value={rangeFrom}
            min={1}
            onChange={e => { setRangeFrom(e.target.value); setRangeErr('') }}
            className="w-16 h-7 input-field rounded-lg px-2 text-center text-xs font-mono tabular-nums outline-none"
          />
          <span className="text-slate-400 text-sm">–</span>
          <input
            type="number"
            placeholder="To"
            value={rangeTo}
            min={1}
            onChange={e => { setRangeTo(e.target.value); setRangeErr('') }}
            className="w-16 h-7 input-field rounded-lg px-2 text-center text-xs font-mono tabular-nums outline-none"
          />
        </div>
        <button type="button" onClick={applyRange} className="btn-ghost h-7 px-3 text-xs ml-1">
          Apply
        </button>
        <button type="button" onClick={() => { setRangeFrom(''); setRangeTo(''); onRangeSelect(null, null) }} className="btn-ghost h-7 px-3 text-xs">
          Clear
        </button>
        {rangeErr && (
          <span className="text-[11px] text-red-500 font-medium ml-2">{rangeErr}</span>
        )}
        <span className="text-[11px] text-slate-500 font-medium ml-auto">
          {items.length} files total
        </span>
      </div>
    </div>
  )
}
