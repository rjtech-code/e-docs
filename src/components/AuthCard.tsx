import type { ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { LogoMark } from './Logo'

const PERKS = ['Every result saved automatically', 'Re-download files anytime', 'All tools stay free']

/** Shared, centered layout for the Login / Sign up pages. */
export default function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-4xl animate-fade-in overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_60px_-30px_rgb(37_99_235/35%)] lg:grid-cols-[1fr_1.1fr]">
      <div className="brand-gradient hidden flex-col justify-between p-10 text-white lg:flex">
        <div>
          <LogoMark size={48} className="rounded-xl ring-4 ring-white/20" />
          <h2 className="mt-6 font-display text-2xl font-bold leading-snug">Your PDFs, organised in one place.</h2>
          <p className="mt-2 text-sm text-white/85">Use any tool as a guest — or sign in to keep your finished files.</p>
        </div>
        <ul className="space-y-3">
          {PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle2 size={18} /> {p}</li>
          ))}
        </ul>
      </div>
      <div className="p-6 sm:p-10">
        <div className="mb-6">
          <LogoMark size={44} className="mb-4 rounded-xl lg:hidden" />
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
