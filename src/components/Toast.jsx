import { useEffect, useState } from 'react'

const ICONS = {
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
}

const STYLES = {
  info:    { wrap: 'bg-blue-500/10 border-blue-500/20',   text: 'text-blue-200',    bar: 'bg-blue-400',    icon: 'text-blue-400' },
  success: { wrap: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-200', bar: 'bg-emerald-400', icon: 'text-emerald-400' },
  error:   { wrap: 'bg-red-500/10 border-red-500/20',     text: 'text-red-200',     bar: 'bg-red-400',     icon: 'text-red-400' },
  warning: { wrap: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-200',   bar: 'bg-amber-400',   icon: 'text-amber-400' },
}

function Toast({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false)
  const style = STYLES[toast.type] || STYLES.info
  const duration = toast.duration ?? 4000

  function dismiss() {
    setExiting(true)
    setTimeout(() => onRemove(toast.id), 250)
  }

  return (
    <div
      className={`
        relative flex items-start gap-3 px-3.5 py-3 rounded-2xl border
        backdrop-blur-xl shadow-xl shadow-black/30
        transition-all duration-250 overflow-hidden
        ${style.wrap}
        ${exiting ? 'opacity-0 translate-x-5 scale-95' : 'animate-slide-in'}
      `}
    >
      {/* Icon */}
      <span className={`shrink-0 mt-0.5 ${style.icon}`}>
        {ICONS[toast.type]}
      </span>

      {/* Message */}
      <p className={`text-[13px] font-medium leading-snug flex-1 ${style.text}`}>
        {toast.message}
      </p>

      {/* Close */}
      <button
        onClick={dismiss}
        className="shrink-0 opacity-40 hover:opacity-90 transition-opacity mt-0.5"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Auto-dismiss progress bar */}
      {duration > 0 && (
        <div
          className={`toast-progress ${style.bar} opacity-30`}
          style={{ animationDuration: `${duration}ms` }}
          onAnimationEnd={dismiss}
        />
      )}
    </div>
  )
}

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t} onRemove={removeToast} />
        </div>
      ))}
    </div>
  )
}
