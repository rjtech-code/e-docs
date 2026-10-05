import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ShieldCheck, Users, FileStack, HardDrive, Trash2, Download, ShieldOff, Shield, UserPlus, CalendarCheck, LayoutDashboard, FolderOpen, Info, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api, type AdminHistoryItem, type AuthUser } from '../lib/api'
import { downloadBlob, formatBytes } from '../lib/pdfCore'
import { getToolById } from '../data/tools'
import { timeAgo, dayKey, perDay } from '../lib/ui'
import BarChart from '../components/BarChart'

type Tab = 'overview' | 'users' | 'files'
type Range = 7 | 30

const HISTORY_LIMIT = 500 // the /admin/history endpoint returns at most this many (newest first)

function StatCard({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note?: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <span className="icon-tile h-11 w-11 rounded-xl"><Icon size={20} /></span>
      <p className="mt-4 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

export default function AdminPanel() {
  const { user: me } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [range, setRange] = useState<Range>(7)
  const [stats, setStats] = useState<{ userCount: number; fileCount: number; totalBytes: number; byTool: { toolId: string; toolName: string; count: number }[] } | null>(null)
  const [users, setUsers] = useState<(AuthUser & { fileCount: number })[]>([])
  const [files, setFiles] = useState<AdminHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [userQuery, setUserQuery] = useState('')

  const loadAll = () => {
    setLoading(true)
    Promise.all([api.adminStats(), api.adminUsers(), api.adminHistory()])
      .then(([s, u, f]) => {
        setStats(s)
        setUsers(u.users)
        setFiles(f.items)
      })
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  const toggleRole = async (u: AuthUser) => {
    setBusyId(u.id)
    try {
      const nextRole = u.role === 'admin' ? 'user' : 'admin'
      await api.adminSetRole(u.id, nextRole)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: nextRole } : x)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not update role')
    } finally {
      setBusyId(null)
    }
  }

  const deleteUser = async (u: AuthUser) => {
    if (!confirm(`Delete ${u.name} (${u.email}) and all their saved files? This can't be undone.`)) return
    setBusyId(u.id)
    try {
      await api.adminDeleteUser(u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      setFiles((prev) => prev.filter((f) => f.user?.id !== u.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not delete user')
    } finally {
      setBusyId(null)
    }
  }

  const deleteFile = async (item: AdminHistoryItem) => {
    setBusyId(item.id)
    setFiles((prev) => prev.filter((f) => f.id !== item.id))
    try {
      await api.adminDeleteHistory(item.id)
    } catch {
      loadAll()
    } finally {
      setBusyId(null)
    }
  }

  const downloadFile = async (item: AdminHistoryItem) => {
    setBusyId(item.id)
    try {
      const blob = await api.downloadHistoryBlob(item)
      downloadBlob(blob, item.outputName)
    } finally {
      setBusyId(null)
    }
  }

  // ---- Derived, display-only numbers (all from the three existing admin endpoints) ----
  const filesPerDay = useMemo(() => perDay(files.map((f) => f.createdAt), range), [files, range])
  const signupsPerDay = useMemo(() => perDay(users.map((u) => u.createdAt), range), [users, range])
  const todayKey = dayKey(new Date())
  const filesToday = useMemo(() => files.filter((f) => dayKey(new Date(f.createdAt)) === todayKey).length, [files, todayKey])
  const newUsersInRange = signupsPerDay.reduce((s, d) => s + d.value, 0)
  const filesInRange = filesPerDay.reduce((s, d) => s + d.value, 0)
  const activeUsersInRange = useMemo(() => {
    const since = Date.now() - range * 86_400_000
    return new Set(files.filter((f) => f.user && new Date(f.createdAt).getTime() >= since).map((f) => f.user!.id)).size
  }, [files, range])
  const adminCount = users.filter((u) => u.role === 'admin').length
  const truncated = files.length >= HISTORY_LIMIT
  const topTools = stats?.byTool.slice(0, 6) ?? []
  const topMax = Math.max(1, ...topTools.map((t) => t.count))
  const toolTotal = stats?.byTool.reduce((s, t) => s + t.count, 0) ?? 0
  const filteredUsers = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(userQuery.trim().toLowerCase()))

  const TABS: [Tab, string, LucideIcon][] = [
    ['overview', 'Overview', LayoutDashboard],
    ['users', `Users${users.length ? ` (${users.length})` : ''}`, Users],
    ['files', `All Files${files.length ? ` (${files.length}${truncated ? '+' : ''})` : ''}`, FolderOpen],
  ]

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="icon-tile h-12 w-12 rounded-2xl"><ShieldCheck size={22} /></div>
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Super Admin Panel</h1>
            <p className="text-sm text-muted-foreground">An overview of your platform's users, files and tool usage.</p>
          </div>
        </div>
        {tab === 'overview' && (
          <div className="flex rounded-xl border border-border bg-white p-1" role="group" aria-label="Date range">
            {([7, 30] as Range[]).map((r) => (
              <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${range === r ? 'bg-primary text-white' : 'text-foreground/70 hover:bg-surface'}`}>
                Last {r} days
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map(([t, label, Icon]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${tab === t ? 'border-primary text-primary-strong' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-16 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6">
          {tab === 'overview' && stats && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard icon={Users} label="Total users" value={stats.userCount.toLocaleString()} note={`${adminCount} admin${adminCount === 1 ? '' : 's'}`} />
                <StatCard icon={UserPlus} label="New sign-ups" value={newUsersInRange.toLocaleString()} note={`Last ${range} days`} />
                <StatCard icon={CalendarCheck} label="Active users" value={activeUsersInRange.toLocaleString()} note={`Saved a file · last ${range} days`} />
                <StatCard icon={FileStack} label="Total files saved" value={stats.fileCount.toLocaleString()} note={`${filesInRange} in last ${range} days`} />
                <StatCard icon={LayoutDashboard} label="Today's activity" value={filesToday.toLocaleString()} note="Files saved today" />
                <StatCard icon={HardDrive} label="Storage used" value={formatBytes(stats.totalBytes)} />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="glass rounded-3xl p-5 sm:p-6">
                  <h2 className="font-display text-lg font-bold">Files saved per day</h2>
                  <p className="mb-4 text-xs text-muted-foreground">Signed-in users · last {range} days{truncated ? ` · based on the newest ${HISTORY_LIMIT} files` : ''}</p>
                  <BarChart data={filesPerDay} unit="files" />
                </section>
                <section className="glass rounded-3xl p-5 sm:p-6">
                  <h2 className="font-display text-lg font-bold">New sign-ups per day</h2>
                  <p className="mb-4 text-xs text-muted-foreground">Accounts created · last {range} days</p>
                  <BarChart data={signupsPerDay} unit="sign-ups" />
                </section>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                <section className="glass rounded-3xl p-5 sm:p-6">
                  <h2 className="font-display text-lg font-bold">Most used tools</h2>
                  <p className="mb-4 text-xs text-muted-foreground">Files saved per tool · all time</p>
                  {topTools.length === 0 ? (
                    <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
                  ) : (
                    <ol className="space-y-3.5">
                      {topTools.map((t, i) => {
                        const Icon = getToolById(t.toolId)?.icon ?? FileStack
                        return (
                          <li key={t.toolId} className="flex items-center gap-3">
                            <span className="w-4 shrink-0 text-xs font-semibold text-muted-foreground">{i + 1}.</span>
                            <span className="icon-tile h-9 w-9 rounded-lg"><Icon size={17} /></span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-sm font-semibold">{t.toolName}</span>
                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{t.count.toLocaleString()}</span> · {Math.round((t.count / toolTotal) * 100)}%</span>
                              </div>
                              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${(t.count / topMax) * 100}%` }} />
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </section>

                <section className="glass rounded-3xl p-5 sm:p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold">Recent activity</h2>
                    <button onClick={() => setTab('files')} className="text-sm font-semibold text-primary hover:underline">View all</button>
                  </div>
                  {files.length === 0 ? (
                    <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {files.slice(0, 6).map((f) => {
                        const Icon = getToolById(f.toolId)?.icon ?? FileStack
                        return (
                          <li key={f.id} className="flex items-center gap-3 py-2.5">
                            <span className="icon-tile h-9 w-9 rounded-lg"><Icon size={16} /></span>
                            <p className="min-w-0 flex-1 text-sm">
                              <span className="font-semibold">{f.user?.name ?? 'Deleted user'}</span> <span className="text-muted-foreground">used</span> <span className="font-medium">{f.toolName}</span>
                            </p>
                            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(f.createdAt)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              </div>

              <p className="flex items-start gap-2.5 rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted-foreground">
                <Info size={17} className="mt-0.5 shrink-0 text-primary" />
                <span>These numbers come from signed-in users' saved files and accounts. Guests use the tools without an account and nothing is recorded for them, so guest activity isn't shown.</span>
              </p>
            </div>
          )}

          {tab === 'users' && (
            <div>
              <div className="relative mb-4 max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Search users…" aria-label="Search users" className="field pl-11" />
              </div>
              <div className="glass overflow-x-auto rounded-3xl">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-surface">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Files</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-surface/60">
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-3">
                            <span className="brand-gradient grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white">{u.name.trim().charAt(0).toUpperCase() || '?'}</span>
                            <span className="font-medium">{u.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.role === 'admin' ? 'bg-primary-soft text-primary-strong' : 'bg-slate-100 text-slate-600'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{u.fileCount}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => toggleRole(u)}
                              disabled={busyId === u.id || u.id === me?.id}
                              title={u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                              aria-label={`${u.role === 'admin' ? 'Remove admin from' : 'Make admin:'} ${u.name}`}
                              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft disabled:opacity-30"
                            >
                              {u.role === 'admin' ? <ShieldOff size={16} /> : <Shield size={16} />}
                              <span className="hidden xl:inline">{u.role === 'admin' ? 'Remove admin' : 'Make admin'}</span>
                            </button>
                            <button
                              onClick={() => deleteUser(u)}
                              disabled={busyId === u.id || u.id === me?.id}
                              title="Delete user"
                              aria-label={`Delete ${u.name}`}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive disabled:opacity-30"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No users match “{userQuery}”.</p>}
              </div>
            </div>
          )}

          {tab === 'files' && (
            files.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-border bg-white py-16 text-center text-muted-foreground">No files yet.</p>
            ) : (
              <ul className="glass divide-y divide-border overflow-hidden rounded-3xl">
                {files.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.outputName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.toolName} · {item.user ? `${item.user.name} (${item.user.email})` : 'Unknown user'} · {formatBytes(item.size)} · {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadFile(item)}
                      disabled={busyId === item.id}
                      aria-label={`Download ${item.outputName}`}
                      className="shrink-0 rounded-lg p-2 text-primary transition-colors hover:bg-primary-soft disabled:opacity-40"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => deleteFile(item)}
                      disabled={busyId === item.id}
                      aria-label={`Delete ${item.outputName}`}
                      className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  )
}
