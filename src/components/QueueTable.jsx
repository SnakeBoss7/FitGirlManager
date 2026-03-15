import FileRow from './FileRow'

export default function QueueTable({ items, progressMap, selected, onToggle, onToggleAll, onRetry }) {
  const allChecked = items.length > 0 && items.every(i => selected.has(i.index))
  const someChecked = items.some(i => selected.has(i.index))

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-widest select-none">
        <input
          type="checkbox"
          checked={allChecked}
          ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
          onChange={onToggleAll}
          className="custom-check !w-4 !h-4"
        />
        <span className="w-7 text-center">#</span>
        <span className="flex-1">File</span>
        <span className="w-20 text-center hidden sm:block">Status</span>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent" />

      {/* Rows */}
      <div className="flex flex-col gap-0.5 mt-1">
        {items.map((item, i) => (
          <FileRow
            key={item.index}
            item={item}
            progress={progressMap[item.index]}
            checked={selected.has(item.index)}
            onToggle={onToggle}
            onRetry={onRetry}
            style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
