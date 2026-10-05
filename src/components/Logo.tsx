import { useId } from 'react'

/** E-Docs mark: a document with a folded corner and an "E" cut into it. */
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <path d="M20 12h17l9 9v27a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V16a4 4 0 0 1 2-4z" fill="#fff" fillOpacity=".95" />
      <path d="M37 12v9h9z" fill="#0b1230" fillOpacity=".25" />
      <path d="M24 27h16v3.6H27.6v3.4H38v3.6H27.6v3.8H40V45H24z" fill="#2563eb" />
    </svg>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-semibold tracking-tight ${className}`}>
      E-<span className="gradient-text">Docs</span>
    </span>
  )
}

/** "A product of Adligare Tech" credit with the company logo. */
export function AdligareCredit({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5" title="Adligare Tech">
      <img src="/adligare-logo.png" alt="Adligare Tech" className={compact ? 'h-6 w-auto' : 'h-8 w-auto'} />
      <span className="leading-tight">
        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">A product of</span>
        <span className="block text-sm font-semibold text-foreground">Adligare Tech</span>
      </span>
    </div>
  )
}
