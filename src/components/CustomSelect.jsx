import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'

/**
 * CustomSelect — glassmorphism dropdown rendered via portal to avoid overflow:hidden clipping.
 * Props:
 *   value, onChange, options=[{value,label,icon?}],
 *   disabled, placeholder, className
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  disabled = false,
  placeholder = 'Select…',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const id = useId()

  const selected = options.find(o => o.value === value)

  // Compute dropdown position from trigger rect
  const openDropdown = useCallback(() => {
    if (disabled || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({
      top:   r.bottom + window.scrollY + 4,
      left:  r.left + window.scrollX,
      width: Math.max(r.width, 150),
    })
    setFocused(options.findIndex(o => o.value === value))
    setOpen(true)
  }, [disabled, options, value])

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return
    function close() { setOpen(false) }
    document.addEventListener('mousedown', (e) => {
      if (!listRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) close()
    })
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  // Keyboard nav
  const handleKeyDown = useCallback((e) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open && focused !== null) { onChange(options[focused].value); setOpen(false) }
      else openDropdown()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { openDropdown(); return }
      setFocused(f => Math.min((f ?? -1) + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocused(f => Math.max((f ?? options.length) - 1, 0))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [disabled, open, focused, options, onChange, openDropdown])

  useEffect(() => {
    if (focused !== null && listRef.current) {
      listRef.current.children[focused]?.scrollIntoView({ block: 'nearest' })
    }
  }, [focused])

  const dropdown = open && createPortal(
    <div
      ref={listRef}
      className="fixed z-[9999] rounded-xl overflow-hidden bg-[#0e1022]/98 backdrop-blur-2xl border border-white/[0.1] shadow-2xl shadow-black/60 animate-dropdown-in"
      style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="py-1.5 max-h-52 overflow-y-auto custom-scroll">
        {options.map((opt, idx) => {
          const isActive  = opt.value === value
          const isFocused = focused === idx
          return (
            <div
              key={opt.value}
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => setFocused(idx)}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`
                flex items-center gap-2.5 px-3.5 py-2 text-sm cursor-pointer select-none
                transition-colors duration-100
                ${isFocused ? 'bg-white/[0.07]' : ''}
                ${isActive ? 'text-violet-300' : 'text-slate-300'}
              `}
            >
              {opt.icon && <span className="shrink-0 opacity-60">{opt.icon}</span>}
              <span className="flex-1 whitespace-nowrap">{opt.label}</span>
              {isActive && (
                <svg className="w-3.5 h-3.5 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )
        })}
      </div>
    </div>,
    document.body
  )

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openDropdown()}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`
          flex items-center gap-2 h-[34px] pl-3 pr-2.5 rounded-lg text-[13px] font-medium
          border transition-all duration-150 select-none outline-none
          ${open
            ? 'bg-violet-500/12 border-violet-500/35 text-violet-200 shadow-sm shadow-violet-500/10'
            : 'bg-white/[0.04] border-white/[0.09] text-slate-300 hover:border-white/[0.15] hover:bg-white/[0.06]'
          }
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
          focus-visible:ring-1 focus-visible:ring-violet-500/50
        `}
      >
        {selected?.icon && <span className="shrink-0 opacity-60">{selected.icon}</span>}
        <span className="whitespace-nowrap">{selected?.label ?? placeholder}</span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdown}
    </div>
  )
}
