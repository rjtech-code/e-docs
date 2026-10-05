import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

/** Slide-out navigation drawer (mobile/tablet). Always mounted so it can animate in and out. */
export default function Drawer({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open} inert={!open}>
      <div className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`absolute inset-y-0 left-0 w-[86%] max-w-xs bg-white shadow-2xl transition-transform duration-250 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <button onClick={onClose} className="absolute right-3 top-5 z-10 rounded-xl p-2 text-foreground/70 hover:bg-surface" aria-label="Close menu">
          <X size={22} />
        </button>
        {children}
      </aside>
    </div>
  )
}
