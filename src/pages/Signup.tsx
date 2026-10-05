import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'
import AuthCard from '../components/AuthCard'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await signup(name.trim(), email.trim(), password)
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Create your account" subtitle="Save every file you create and find it again anytime.">
      <form onSubmit={submit} className="space-y-4">
        {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={16} className="shrink-0" /> {error}</div>}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">Name</label>
          <input id="name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Your name" />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">Password</label>
          <div className="relative">
            <input id="password" type={showPw ? 'text' : 'password'} autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="field pr-11" placeholder="At least 6 characters" aria-describedby="pw-hint" />
            <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p id="pw-hint" className="mt-1 text-xs text-muted-foreground">Use 6 or more characters.</p>
        </div>
        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold">Confirm password</label>
          <input id="confirm" type={showPw ? 'text' : 'password'} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field" placeholder="Type your password again" />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full rounded-xl px-6 py-3">{loading ? 'Creating account…' : 'Create account'}</button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Login</Link>
        </p>
      </form>
    </AuthCard>
  )
}
