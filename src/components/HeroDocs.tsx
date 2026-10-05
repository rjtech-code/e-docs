import { useId } from 'react'

/** Light, friendly document illustration for the landing hero (pure SVG). */
export default function HeroDocs({ className = '' }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 420 340" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-doc`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient>
        <linearGradient id={`${id}-cloud`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dbeafe" /><stop offset="1" stopColor="#bfdbfe" /></linearGradient>
        <radialGradient id={`${id}-bg`} cx="50%" cy="55%" r="55%"><stop offset="0" stopColor="#dbeafe" /><stop offset="1" stopColor="#dbeafe" stopOpacity="0" /></radialGradient>
        <filter id={`${id}-sh`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#1d4ed8" floodOpacity=".18" /></filter>
      </defs>
      <ellipse cx="210" cy="180" rx="200" ry="150" fill={`url(#${id}-bg)`} />
      {/* cloud */}
      <path d="M262 92c4-30 30-50 60-46 22 3 38 20 42 40 22 2 38 20 36 42-2 20-20 34-40 34H262c-22 0-38-16-38-36s16-34 38-34z" fill={`url(#${id}-cloud)`} />
      <g className="animate-float">
        {/* back page */}
        <rect x="200" y="96" width="132" height="168" rx="14" fill="#ffffff" stroke="#dbe7fb" filter={`url(#${id}-sh)`} />
        <rect x="222" y="200" width="88" height="8" rx="4" fill="#dbeafe" />
        <rect x="222" y="218" width="70" height="8" rx="4" fill="#dbeafe" />
        <rect x="222" y="236" width="80" height="8" rx="4" fill="#dbeafe" />
        {/* front document */}
        <g filter={`url(#${id}-sh)`}>
          <path d="M124 64h86l36 36v168a14 14 0 0 1-14 14H124a14 14 0 0 1-14-14V78a14 14 0 0 1 14-14z" fill="#ffffff" />
          <path d="M210 64v26a10 10 0 0 0 10 10h26z" fill="#dbeafe" />
        </g>
        <rect x="132" y="96" width="60" height="8" rx="4" fill="#bfdbfe" />
        <rect x="132" y="114" width="90" height="8" rx="4" fill="#dbeafe" />
        <rect x="124" y="148" width="98" height="46" rx="10" fill={`url(#${id}-doc)`} />
        <text x="173" y="179" textAnchor="middle" fontFamily="Plus Jakarta Sans, Inter, sans-serif" fontWeight="800" fontSize="22" fill="#ffffff">PDF</text>
        <rect x="132" y="212" width="90" height="8" rx="4" fill="#dbeafe" />
        <rect x="132" y="230" width="72" height="8" rx="4" fill="#dbeafe" />
        <rect x="132" y="248" width="82" height="8" rx="4" fill="#dbeafe" />
      </g>
      {/* floating badges */}
      <g filter={`url(#${id}-sh)`}>
        <circle cx="300" cy="62" r="24" fill="#2563eb" />
        <path d="M292 52h11l6 6v14a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V54a2 2 0 0 1 2-2z" fill="#fff" />
        <rect x="66" y="132" width="44" height="44" rx="12" fill="#3b82f6" />
        <rect x="78" y="144" width="20" height="4" rx="2" fill="#fff" /><rect x="78" y="152" width="20" height="4" rx="2" fill="#fff" fillOpacity=".8" /><rect x="78" y="160" width="14" height="4" rx="2" fill="#fff" fillOpacity=".8" />
        <rect x="336" y="196" width="44" height="44" rx="12" fill="#2563eb" />
        <rect x="349" y="215" width="18" height="14" rx="3" fill="#fff" /><path d="M352 215v-4a6 6 0 0 1 12 0v4" stroke="#fff" strokeWidth="3" fill="none" />
        <rect x="150" y="286" width="40" height="40" rx="11" fill="#3b82f6" />
        <path d="M170 296l11 4v8c0 6-5 10-11 12-6-2-11-6-11-12v-8z" fill="#fff" />
      </g>
      <circle cx="86" cy="88" r="5" fill="#bfdbfe" /><circle cx="376" cy="140" r="4" fill="#bfdbfe" /><circle cx="250" cy="314" r="6" fill="#dbeafe" />
    </svg>
  )
}
