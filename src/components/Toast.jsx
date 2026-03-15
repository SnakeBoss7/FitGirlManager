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

const COLORS = {
  info:    'bg-blue-500/10 border-blue-500/20 text-blue-300',
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  error:   'bg-red-500/10 border-red-500/20 text-red-300',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
}

function Toast({ toast, onRemove }) {
  const [isExiting, setIsExiting] = useState(false)

  function handleRemove() {
    setIsExiting(true)
    setTimeout(() => onRemove(toast.id), 200)
  }

  return (
    <div
      className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border backdrop-blur-md
        shadow-lg shadow-black/20 transition-all duration-200
        ${isExiting ? 'opacity-0 translate-x-4' : 'animate-slide-in'}
        ${COLORS[toast.type] || COLORS.info}`}
    >
      <span className="shrink-0 mt-px opacity-70">{ICONS[toast.type]}</span>
      <p className="text-xs font-medium leading-snug flex-1">{toast.message}</p>
      <button onClick={handleRemove} className="shrink-0 opacity-40 hover:opacity-80 transition-opacity mt-px">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-72 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t} onRemove={removeToast} />
        </div>
      ))}
    </div>
  )
}
