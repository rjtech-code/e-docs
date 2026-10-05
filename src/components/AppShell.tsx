import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Home, LayoutGrid, History, Settings, Languages, LogOut, LogIn, ShieldCheck, Menu, Search, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { tools } from '../data/tools'
import { pushRecentTool } from '../lib/recentTools'
import { LogoMark, Wordmark, AdligareCredit } from './Logo'
import CommandPalette from './CommandPalette'
import { PublicNavbar, PublicFooter } from './PublicLayout'
import Drawer from './Drawer'

function useNav() {
  return [
    { to: '/home', label: 'Home', icon: Home, end: true },
    { to: '/all-tools', label: 'All Tools', icon: LayoutGrid, end: false },
    { to: '/history', label: 'Recent Files & History', icon: History, end: false },
    { to: '/settings', label: 'Settings', icon: Settings, end: false },
  ]
}

function SidebarContent({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const nav = useNav()
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3.5 ${mobile ? 'py-3 text-[15px]' : 'py-2.5 text-sm'} font-medium transition-colors ${
      isActive ? 'bg-primary-soft text-primary-strong' : 'text-foreground/75 hover:bg-surface hover:text-foreground'
    }`

  return (
    <div className="flex h-full flex-col">
      <Link to="/home" onClick={onNavigate} className="flex items-center gap-3 px-5 pb-5 pt-6">
        <LogoMark size={38} className="glow-cyan rounded-xl" />
        <Wordmark className="text-xl" />
      </Link>
      {mobile && user && (
        <Link to="/settings" onClick={onNavigate} className="mx-3 mb-3 flex items-center gap-3 rounded-2xl border border-border bg-surface px-3.5 py-3">
          <span className="brand-gradient grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white">{user.name.trim().charAt(0).toUpperCase() || '?'}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">View profile</span>
          </span>
        </Link>
      )}
      <p className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Menu</p>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main">
        {nav.map((n) => (
          <NavLink key={n.label} to={n.to} end={n.end} onClick={onNavigate} className={linkClass}>
            <n.icon size={18} /> {n.label}
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <NavLink to="/admin" onClick={onNavigate} className={linkClass}>
            <ShieldCheck size={18} /> Admin Panel
          </NavLink>
        )}
      </nav>
      <div className="space-y-2 p-3">
        <NavLink
          to="/translate"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-semibold transition-colors ${
              isActive ? 'border-primary bg-primary-soft text-primary-strong' : 'border-primary/25 bg-primary-soft/60 text-primary-strong hover:bg-primary-soft'
            }`
          }
        >
          <Languages size={18} /> Translate
          <span className="ml-auto rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span>
        </NavLink>
        {user ? (
          <button
            onClick={() => { onNavigate?.(); logout(); navigate('/') }}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-red-50 hover:text-destructive"
          >
            <LogOut size={18} /> Sign Out
          </button>
        ) : (
          <div className="grid gap-2">
            <Link to="/login" onClick={onNavigate} className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold">
              <LogIn size={17} /> Sign In
            </Link>
            <Link to="/signup" onClick={onNavigate} className="btn-primary flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm">
              <UserPlus size={17} /> Create account
            </Link>
          </div>
        )}
        <div className="border-t border-border pt-3">
          <AdligareCredit />
        </div>
      </div>
    </div>
  )
}

function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { user } = useAuth()
  const initial = user?.name?.trim().charAt(0).toUpperCase() || ''
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-white/85 px-4 backdrop-blur-md sm:px-8">
      <button onClick={onMenu} className="-ml-1 rounded-xl p-2.5 text-foreground hover:bg-surface lg:hidden" aria-label="Open menu">
        <Menu size={22} />
      </button>
      <Link to="/home" className="flex items-center gap-2 lg:hidden">
        <LogoMark size={30} />
        <Wordmark className="hidden text-lg min-[400px]:inline" />
      </Link>
      <button onClick={onSearch} className="ml-auto hidden h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 md:flex lg:ml-0" aria-label="Search tools">
        <Search size={17} />
        <span className="flex-1">Search tools…</span>
        <kbd className="rounded-md border border-border bg-white px-1.5 py-0.5 text-[11px]">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <div className="flex-1 md:hidden" />
      <div className="hidden flex-1 md:block" />
      <button onClick={onSearch} className="rounded-xl p-2.5 text-foreground/80 transition-colors hover:bg-surface md:hidden" aria-label="Search tools" title="Search tools (Ctrl/⌘ + K)">
        <Search size={20} />
      </button>
      {user ? (
        <Link to="/settings" title="Your account" className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-surface sm:pr-3">
          <span className="brand-gradient grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white">{initial || '?'}</span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-[10rem] truncate text-sm font-semibold">{user.name}</span>
            <span className="block text-xs text-muted-foreground">{user.role === 'admin' ? 'Admin' : 'Member'}</span>
          </span>
        </Link>
      ) : (
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-foreground/80 hover:bg-surface sm:block">Sign in</Link>
          <Link to="/signup" className="btn-primary rounded-xl px-4 py-2 text-sm">Sign up</Link>
        </div>
      )}
    </header>
  )
}

function AppFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} E-Docs · {tools.length} free PDF tools</p>
        <AdligareCredit compact />
      </div>
    </footer>
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const { pathname } = useLocation()
  const isLanding = pathname === '/'

  useEffect(() => {
    const t = tools.find((x) => x.path === pathname)
    if (t) pushRecentTool(t.id)
    window.scrollTo({ top: 0 })
    setDrawer(false)
  }, [pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
    }
    const onOpen = () => setPalette(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('edocs:open-search', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('edocs:open-search', onOpen)
    }
  }, [])

  if (isLanding) {
    return (
      <div className="min-h-screen bg-white">
        <PublicNavbar />
        <main>{children}</main>
        <PublicFooter />
        <CommandPalette open={palette} onClose={() => setPalette(false)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-white lg:block">
        <SidebarContent />
      </aside>
      <Drawer open={drawer} onClose={() => setDrawer(false)} label="Navigation">
        <SidebarContent mobile onNavigate={() => setDrawer(false)} />
      </Drawer>
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
        <main className="flex-1 px-4 pb-4 pt-6 sm:px-8 sm:pt-8">{children}</main>
        <AppFooter />
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}
