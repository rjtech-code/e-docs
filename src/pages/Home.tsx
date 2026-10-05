import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight, Zap, ShieldCheck, MousePointerClick, Download, MonitorSmartphone, LayoutGrid, UploadCloud,
  Combine, FileText, PenTool, Lock, ScanText, Languages, CheckCircle2, HardDrive, KeyRound, Trash2, Laptop, Search,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { tools, categoryLabels, getToolById, type ToolCategory } from '../data/tools'
import { LANGUAGES } from '../lib/translate'
import HeroDocs from '../components/HeroDocs'
import ToolCard from '../components/ToolCard'

const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Zap, title: 'Fast', text: 'Most tools run right in your browser — no waiting for uploads.' },
  { icon: ShieldCheck, title: 'Secure', text: 'Nothing is saved to your account unless you sign in.' },
  { icon: MousePointerClick, title: 'Easy to Use', text: 'Pick a tool, add your file, download. That’s it.' },
  { icon: Laptop, title: 'No Installation', text: 'Works in any modern web browser.' },
  { icon: MonitorSmartphone, title: 'Works on Any Device', text: 'Desktop, laptop, tablet or phone.' },
]

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: LayoutGrid, title: 'Choose a tool', text: 'Find the tool you need — merge, convert, sign, protect and more.' },
  { icon: UploadCloud, title: 'Upload your file', text: 'Drag & drop your file or tap “Browse files”. Adjust options if you want.' },
  { icon: Download, title: 'Download your result', text: 'Click the action button and download your finished file.' },
]

interface Highlight {
  id: string
  label: string
  icon: LucideIcon
  title: string
  text: string
  toolIds: string[]
  cta: string
}

const HIGHLIGHTS: Highlight[] = [
  { id: 'organize', label: 'Organize & Compress', icon: Combine, title: 'Put pages exactly where you want them', text: 'Combine several PDFs into one, split out the pages you need, reorder or rotate pages and shrink large files so they’re easy to share.', toolIds: ['merge-pdf', 'split-pdf', 'compress-pdf', 'organize-pdf', 'rotate-pdf', 'crop-pdf', 'repair-pdf'], cta: 'merge-pdf' },
  { id: 'convert', label: 'PDF Conversion', icon: FileText, title: 'Convert to and from PDF in seconds', text: 'Turn PDFs into editable Word, Excel and PowerPoint files or images — and turn documents, photos and web pages back into PDFs.', toolIds: ['pdf-to-word', 'pdf-to-excel', 'pdf-to-powerpoint', 'pdf-to-jpg', 'word-to-pdf', 'excel-to-pdf', 'powerpoint-to-pdf', 'jpg-to-pdf', 'html-to-pdf', 'scan-to-pdf', 'pdf-to-pdfa'], cta: 'pdf-to-word' },
  { id: 'edit', label: 'Editing & Signing', icon: PenTool, title: 'Add text, signatures and stamps', text: 'Write on any page, draw your signature, stamp a watermark or add page numbers — without any desktop software.', toolIds: ['edit-pdf', 'sign-pdf', 'watermark-pdf', 'page-numbers'], cta: 'sign-pdf' },
  { id: 'security', label: 'PDF Security', icon: Lock, title: 'Keep private documents private', text: 'Lock a PDF with a password, remove a password you know, or black out sensitive information before you share.', toolIds: ['protect-pdf', 'unlock-pdf', 'redact-pdf'], cta: 'protect-pdf' },
  { id: 'ocr', label: 'OCR & Compare', icon: ScanText, title: 'Make scanned documents searchable', text: 'Recognise the text inside scanned PDFs so you can select and search it, or compare two versions of a document line by line.', toolIds: ['ocr-pdf', 'compare-pdf'], cta: 'ocr-pdf' },
]

const SECURITY: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Laptop, title: 'Processed on your device', text: 'Most tools work entirely inside your browser, so your file never leaves your computer or phone.' },
  { icon: HardDrive, title: 'Saved only when you choose', text: 'Results are stored only when you’re signed in, so you can download them again later. Guests’ files are never saved.' },
  { icon: Trash2, title: 'You stay in control', text: 'Delete any saved file at any time from your History page.' },
  { icon: FileText, title: 'Temporary server files are removed', text: 'Office conversions may use our conversion server for better layout. Its temporary files are deleted as soon as the conversion finishes.' },
  { icon: KeyRound, title: 'Protected accounts', text: 'Account passwords are stored only as secure one-way hashes — never as plain text.' },
]

const CATS: (ToolCategory | 'all')[] = ['all', 'organize', 'convert', 'edit', 'security', 'translate']

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="chip uppercase tracking-wider">{eyebrow}</span>
      <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-base text-muted-foreground">{text}</p>}
    </div>
  )
}

function HighlightVisual({ h }: { h: Highlight }) {
  const list = h.toolIds.map(getToolById).filter((t): t is NonNullable<ReturnType<typeof getToolById>> => !!t)
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary-soft to-white" aria-hidden="true" />
      <div className="glass rounded-3xl p-5">
        <div className="mb-4 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          <span className="ml-3 h-2 w-28 rounded-full bg-surface-2" />
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.slice(0, 8).map((t) => (
            <li key={t.id}>
              <Link to={t.path} className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary-soft">
                <span className="icon-tile h-8 w-8 rounded-lg"><t.icon size={16} /></span>
                <span className="truncate">{t.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()
  const [cat, setCat] = useState<ToolCategory | 'all'>('all')
  const shown = useMemo(() => (cat === 'all' ? tools : tools.filter((t) => t.category === cat)), [cat])
  const openSearch = () => window.dispatchEvent(new Event('edocs:open-search'))

  return (
    <div id="top">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf2ff] via-[#f4f8ff] to-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-16 lg:px-8">
          <div className="animate-fade-in">
            <span className="chip"><CheckCircle2 size={14} /> All-in-one PDF toolkit · 100% free</span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">
              Powerful PDF Tools.<br /><span className="gradient-text">Simple for Everyone.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Merge, split, compress, convert, sign, protect and translate your documents — right in your browser. No software to install, no learning curve.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/home" className="btn-primary flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base">
                Get Started <ArrowRight size={18} />
              </Link>
              <a href="#tools" className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold">
                Explore Tools
              </a>
            </div>
            <button onClick={openSearch} className="mt-6 flex h-12 w-full max-w-md items-center gap-3 rounded-xl border border-border bg-white px-4 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary/40">
              <Search size={17} /> <span className="flex-1">Search for a tool, e.g. “merge” or “word”</span>
            </button>
          </div>
          <HeroDocs className="mx-auto w-full max-w-md md:max-w-none" />
        </div>
      </section>

      {/* BENEFITS */}
      <section aria-label="Why E-Docs" className="border-y border-border bg-white">
        <ul className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-5 lg:px-8">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex items-start gap-3 rounded-2xl p-3">
              <span className="icon-tile h-11 w-11 rounded-xl"><b.icon size={20} /></span>
              <span>
                <span className="block font-display text-[15px] font-bold">{b.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{b.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ALL TOOLS */}
      <section id="tools" className="bg-[#f7faff] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Our tools" title="Everything You Need for PDFs" text={`${tools.length} easy tools — choose one and get your work done in a few clicks.`} />
          <div className="mt-8 flex flex-wrap justify-center gap-2" role="group" aria-label="Filter tools by category">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                aria-pressed={cat === c}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${cat === c ? 'border-primary bg-primary text-white' : 'border-border bg-white text-foreground/75 hover:border-primary/40 hover:text-primary-strong'}`}
              >
                {c === 'all' ? `All tools (${tools.length})` : categoryLabels[c]}
              </button>
            ))}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((t) => <ToolCard key={t.id} tool={t} />)}
          </div>
          <div className="mt-10 text-center">
            <Link to="/home" className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm">
              Get Started <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="How it works" title="Three simple steps" text="No sign-up needed to use any tool." />
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-3xl border border-border bg-[#f7faff] p-7 text-center">
                <span className="absolute -top-4 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full bg-primary text-sm font-bold text-white shadow-md">{i + 1}</span>
                <span className="mx-auto mt-2 grid h-16 w-16 place-items-center rounded-2xl bg-white text-primary shadow-sm"><s.icon size={28} /></span>
                <h3 className="mt-5 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FEATURE HIGHLIGHTS */}
      <section id="features" className="soft-section py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Features" title="One place for every PDF job" text="Here’s a closer look at what you can do." />
          <div className="mt-14 space-y-16 sm:space-y-20">
            {HIGHLIGHTS.map((h, i) => {
              const cta = getToolById(h.cta)!
              return (
                <article key={h.id} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
                  <div className={i % 2 ? 'md:order-2' : ''}>
                    <span className="chip"><h.icon size={14} /> {h.label}</span>
                    <h3 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{h.title}</h3>
                    <p className="mt-3 leading-relaxed text-muted-foreground">{h.text}</p>
                    <Link to={cta.path} className="btn-primary mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm">
                      Try {cta.name} <ArrowRight size={16} />
                    </Link>
                  </div>
                  <HighlightVisual h={h} />
                </article>
              )
            })}

            {/* Translate highlight */}
            <article className="grid items-center gap-8 rounded-3xl border border-primary/15 bg-white p-6 shadow-sm sm:p-10 md:grid-cols-[1fr_1.1fr] md:gap-14">
              <div>
                <span className="chip"><Languages size={14} /> Translate</span>
                <h3 className="mt-3 font-display text-2xl font-bold sm:text-3xl">हिन्दी ⇄ English and more</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">Translate text, PDF, Word and TXT files between Hindi, English and {LANGUAGES.length - 2} more Indian languages, then download the result as TXT, Word or PDF.</p>
                <Link to="/translate" className="btn-primary mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm">
                  Try Translate <ArrowRight size={16} />
                </Link>
              </div>
              <ul className="flex flex-wrap gap-2" aria-label="Supported languages">
                {LANGUAGES.map((l) => (
                  <li key={l.code} className="rounded-xl border border-border bg-[#f7faff] px-3.5 py-2 text-sm font-medium">{l.native}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Privacy & security" title="Your documents stay yours" text="Here’s exactly what happens to your files." />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY.map((s) => (
              <li key={s.title} className="rounded-3xl border border-border bg-[#f7faff] p-6">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-success"><s.icon size={22} /></span>
                <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="soft-section py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <div>
            <span className="chip uppercase tracking-wider">About E-Docs</span>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">More than just a PDF tool</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">E-Docs is a product of Adligare Tech. We built it so anyone — students, offices, shop owners, families — can handle everyday document tasks without expensive software or technical know-how.</p>
            <p className="mt-3 leading-relaxed text-muted-foreground">Create a free account to keep your finished files in one place and download them again whenever you need.</p>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            {[
              { k: `${tools.length}`, v: 'PDF & document tools' },
              { k: `${LANGUAGES.length}`, v: 'Languages for translation' },
              { k: '100%', v: 'Free to use' },
              { k: '0', v: 'Apps to install' },
            ].map((s) => (
              <div key={s.v} className="rounded-3xl border border-border bg-white p-6 text-center shadow-sm">
                <dt className="sr-only">{s.v}</dt>
                <dd className="font-display text-4xl font-extrabold text-primary">{s.k}</dd>
                <dd className="mt-1 text-sm text-muted-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="brand-gradient mx-auto max-w-5xl rounded-[2rem] px-6 py-12 text-center text-white shadow-[0_24px_60px_-28px_rgb(37_99_235/70%)] sm:px-12 sm:py-16">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Ready to work with your PDFs?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">Pick a tool and get your file done in under a minute. No account required.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/home" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-primary-strong shadow-sm transition-colors hover:bg-primary-soft">
              Get Started <ArrowRight size={18} />
            </Link>
            {!user && (
              <Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/50 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10">
                Create free account
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
