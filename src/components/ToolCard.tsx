import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ToolDef } from '../data/tools'

/** Tool card: icon, name, one-line description and a clear "Use Tool" button (the whole card is clickable). */
export default function ToolCard({ tool, compact = false }: { tool: ToolDef; compact?: boolean }) {
  const Icon = tool.icon
  return (
    <div className="tile group flex flex-col rounded-2xl p-5">
      <span className="icon-tile h-12 w-12 rounded-xl transition-colors group-hover:bg-primary group-hover:text-white"><Icon size={22} /></span>
      <h3 className="mt-4 font-display text-base font-semibold leading-tight">{tool.name}</h3>
      {!compact && <p className="mt-1.5 flex-1 text-sm leading-snug text-muted-foreground">{tool.description}</p>}
      <Link
        to={tool.path}
        aria-label={`Use ${tool.name}`}
        className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary-soft px-3.5 py-2 text-sm font-semibold text-primary-strong transition-colors after:absolute after:inset-0 after:rounded-2xl after:content-[''] group-hover:bg-primary group-hover:text-white"
      >
        Use Tool <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  )
}
