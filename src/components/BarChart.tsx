import { useState } from 'react'

export interface BarDatum {
  key: string
  label: string
  value: number
}

/** Single-series column chart (one hue — the card title names the series, so no legend). Hover/focus shows a tooltip. */
export default function BarChart({ data, unit, height = 180 }: { data: BarDatum[]; unit: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const niceMax = max <= 4 ? Math.ceil(max / 2) * 2 : Math.ceil(max / 4) * 4 // keeps every tick a whole number
  const ticks = [niceMax, niceMax / 2, 0]
  const labelEvery = Math.max(1, Math.ceil(data.length / 7))

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted-foreground" style={{ height }} aria-hidden="true">
          {ticks.map((t) => <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">{Number.isInteger(t) ? t : t.toFixed(1)}</span>)}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: height - 24 }} aria-hidden="true">
            {ticks.map((t) => <span key={t} className="block border-t border-dashed border-border last:border-solid last:border-slate-300" />)}
          </div>
          <div className="relative flex items-end gap-[2px]" style={{ height: height - 24 }} onMouseLeave={() => setActive(null)}>
            {data.map((d, i) => (
              <div
                key={d.key}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
                tabIndex={0}
                aria-label={`${d.label}: ${d.value} ${unit}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <div
                  className={`w-full max-w-7 rounded-t-[4px] transition-colors ${active === i ? 'bg-primary-strong' : 'bg-primary'} ${d.value === 0 ? 'opacity-0' : ''}`}
                  style={{ height: `${(d.value / niceMax) * 100}%`, minHeight: d.value > 0 ? 3 : 0 }}
                />
                {active === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-white shadow-lg">
                    <span className="font-semibold">{d.value}</span> {unit} · {d.label}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex h-[18px] gap-[2px] text-[11px] text-muted-foreground" aria-hidden="true">
            {data.map((d, i) => (
              <span key={d.key} className="flex min-w-0 flex-1 justify-center overflow-visible whitespace-nowrap">{i % labelEvery === 0 || i === data.length - 1 ? d.label : ''}</span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <thead><tr><th>Date</th><th>{unit}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.key}><td>{d.label}</td><td>{d.value}</td></tr>)}</tbody>
      </table>
    </div>
  )
}
