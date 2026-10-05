import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Settings as SettingsIcon, LogOut, Trash2, ShieldCheck, Mail, User as UserIcon, Check, CalendarDays, History, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { clearRecentTools } from '../lib/recentTools'
import { AdligareCredit } from '../components/Logo'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [cleared, setCleared] = useState(false)
  if (!user) return null

  const rows = [
    { icon: UserIcon, label: 'Name', value: user.name },
    { icon: Mail, label: 'Email', value: user.email },
    { icon: ShieldCheck, label: 'Role', value: user.role === 'admin' ? 'Administrator' : 'User' },
    { icon: CalendarDays, label: 'Member since', value: new Date(user.createdAt).toLocaleDateString() },
  ]

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <div className="flex items-center gap-4">
        <span className="icon-tile h-12 w-12 rounded-2xl"><SettingsIcon size={22} /></span>
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Settings</h1>
          <p className="text-sm text-muted-foreground">Your profile and preferences.</p>
        </div>
      </div>

      <section className="glass mt-6 rounded-3xl p-5 sm:p-6" aria-labelledby="profile-h">
        <div className="mb-4 flex items-center gap-4">
          <span className="brand-gradient grid h-14 w-14 shrink-0 place-items-center rounded-full text-xl font-bold text-white">{user.name.trim().charAt(0).toUpperCase() || '?'}</span>
          <div className="min-w-0">
            <h2 id="profile-h" className="truncate font-display text-lg font-bold">{user.name}</h2>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 px-4 py-3">
              <r.icon size={17} className="shrink-0 text-primary" />
              <span className="w-28 shrink-0 text-sm text-muted-foreground">{r.label}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <section className="glass rounded-3xl p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold">Your files</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">See, re-download or delete everything you've saved.</p>
          <Link to="/history" className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
            <History size={16} /> Open History <ArrowRight size={15} />
          </Link>
        </section>
        <section className="glass rounded-3xl p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold">On this device</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Recently opened tools are remembered in this browser only.</p>
          <button onClick={() => { clearRecentTools(); setCleared(true); setTimeout(() => setCleared(false), 2000) }} className="btn-ghost flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
            {cleared ? <Check size={16} className="text-success" /> : <Trash2 size={16} />} {cleared ? 'Cleared' : 'Clear recent tools'}
          </button>
        </section>
      </div>

      <section className="glass mt-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 sm:p-6">
        <AdligareCredit />
        <button onClick={() => { logout(); navigate('/') }} className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100">
          <LogOut size={16} /> Sign out
        </button>
      </section>
    </div>
  )
}
