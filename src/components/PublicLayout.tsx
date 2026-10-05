import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, ArrowRight, LogIn, LayoutGrid, Home, Sparkles, ListChecks, Info, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { tools, categoryLabels, type ToolCategory } from '../data/tools'
import { LogoMark, Wordmark, AdligareCredit } from './Logo'
import Drawer from './Drawer'

const LINKS = [
  { href: '#top', label: 'Home', icon: Home },
  { href: '#tools', label: 'Tools', icon: LayoutGrid },
  { href: '#features', label: 'Features', icon: Sparkles },
  { href: '#how-it-works', label: 'How It Works', icon: ListChecks },
  { href: '#about', label: 'About', icon: Info },
]

export function PublicNavbar() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])


  return (
    <>
      <header className={`sticky top-0 z-40 bg-white/90 backdrop-blur-md transition-shadow ${scrolled ? 'shadow-[0_1px_0_#e1e9f5,0_8px_24px_-16px_rgb(37_99_235/25%)]' : ''}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:h-[72px] sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-2.5" aria-label="E-Docs home">
            <LogoMark size={36} className="glow-cyan rounded-xl" />
            <Wordmark className="text-xl" />
          </a>
          <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Main">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="rounded-lg px-3.5 py-2 text-sm font-medium text-foreground/75 transition-colors hover:bg-surface hover:text-primary-strong">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 lg:ml-0 lg:flex">
            {user ? (
              <Link to="/settings" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground/80 hover:bg-surface">{user.name.split(' ')[0]}</Link>
            ) : (
              <Link to="/login" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground/80 hover:bg-surface"><LogIn size={16} /> Login</Link>
            )}
            <Link to="/home" className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm">
              {user ? 'Open App' : 'Get Started'} <ArrowRight size={16} />
            </Link>
          </div>
          <button onClick={() => setOpen(true)} className="ml-auto rounded-xl p-2.5 text-foreground hover:bg-surface lg:hidden" aria-label="Open menu">
            <Menu size={24} />
          </button>
        </div>
      </header>

      <Drawer open={open} onClose={() => setOpen(false)} label="Site navigation">
        <div className="flex h-full flex-col">
          <a href="#top" onClick={() => setOpen(false)} className="flex items-center gap-3 px-5 pb-5 pt-6">
            <LogoMark size={38} className="glow-cyan rounded-xl" />
            <Wordmark className="text-xl" />
          </a>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-medium text-foreground/80 hover:bg-surface hover:text-foreground">
                <l.icon size={19} className="text-primary" /> {l.label}
              </a>
            ))}
          </nav>
          <div className="grid gap-2 border-t border-border p-4">
            {user ? (
              <Link to="/home" onClick={() => setOpen(false)} className="btn-primary flex items-center justify-center gap-2 rounded-xl py-3 text-sm">
                <LayoutDashboard size={17} /> Open App
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"><LogIn size={17} /> Login</Link>
                <Link to="/home" onClick={() => setOpen(false)} className="btn-primary flex items-center justify-center gap-2 rounded-xl py-3 text-sm">Get Started <ArrowRight size={17} /></Link>
              </>
            )}
          </div>
        </div>
      </Drawer>
    </>
  )
}

const FOOTER_CATS: ToolCategory[] = ['organize', 'convert', 'edit', 'security']

export function PublicFooter() {
  const { user } = useAuth()
  return (
    <footer className="border-t border-border bg-[#f7faff]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.3fr_repeat(3,1fr)] lg:grid-cols-[1.4fr_repeat(5,1fr)] lg:px-8">
        <div>
          <a href="#top" className="flex items-center gap-2.5">
            <LogoMark size={36} className="rounded-xl" />
            <Wordmark className="text-xl" />
          </a>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">Free, simple PDF tools for everyone — merge, convert, sign, protect and translate your documents in a few clicks.</p>
          <div className="mt-5"><AdligareCredit /></div>
        </div>
        {FOOTER_CATS.map((c) => (
          <div key={c} className="hidden lg:block">
            <h3 className="text-sm font-bold">{categoryLabels[c]}</h3>
            <ul className="mt-3 space-y-2">
              {tools.filter((t) => t.category === c).slice(0, 6).map((t) => (
                <li key={t.id}><Link to={t.path} className="text-sm text-muted-foreground hover:text-primary">{t.name}</Link></li>
              ))}
            </ul>
          </div>
        ))}
        <div className="md:col-span-1 lg:hidden">
          <h3 className="text-sm font-bold">Tools</h3>
          <ul className="mt-3 space-y-2">
            {['merge-pdf', 'split-pdf', 'compress-pdf', 'pdf-to-word', 'sign-pdf', 'protect-pdf'].map((id) => {
              const t = tools.find((x) => x.id === id)!
              return <li key={id}><Link to={t.path} className="text-sm text-muted-foreground hover:text-primary">{t.name}</Link></li>
            })}
            <li><Link to="/all-tools" className="text-sm font-semibold text-primary hover:underline">All {tools.length} tools →</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold">Company & Support</h3>
          <ul className="mt-3 space-y-2">
            <li><a href="#about" className="text-sm text-muted-foreground hover:text-primary">About</a></li>
            <li><a href="#security" className="text-sm text-muted-foreground hover:text-primary">Privacy & Security</a></li>
            <li><a href="#how-it-works" className="text-sm text-muted-foreground hover:text-primary">How It Works</a></li>
            <li><Link to="/translate" className="text-sm text-muted-foreground hover:text-primary">Translate</Link></li>
            {user ? (
              <li><Link to="/home" className="text-sm text-muted-foreground hover:text-primary">Open App</Link></li>
            ) : (
              <>
                <li><Link to="/login" className="text-sm text-muted-foreground hover:text-primary">Login</Link></li>
                <li><Link to="/signup" className="text-sm text-muted-foreground hover:text-primary">Create account</Link></li>
              </>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-5 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">© {new Date().getFullYear()} E-Docs · A product of Adligare Tech · {tools.length} free PDF tools</p>
      </div>
    </footer>
  )
}
