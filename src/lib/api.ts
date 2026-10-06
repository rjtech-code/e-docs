// Thin client for the E-Docs backend (backend/) — auth + per-user file history.
import { API_BASE_URL } from '../../backend/urls.config.js'

const TOKEN_KEY = 'edocs_token'

// Backend URL the browser calls — set once in backend/urls.config.js (API_BASE_URL;
// '' = same domain via relative "/api/..." calls). The VITE_API_BASE env var, set on the
// frontend host at build time (e.g. Vercel), overrides it.
export const API_BASE = (import.meta.env.VITE_API_BASE ?? API_BASE_URL).replace(/\/$/, '')

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
  createdAt: string
}

export interface HistoryItem {
  id: string
  toolId: string
  toolName: string
  outputName: string
  mimeType?: string
  size: number
  createdAt: string
  downloadUrl: string
}

export interface AdminHistoryItem extends HistoryItem {
  user: { id: string; name: string; email: string } | null
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* non-JSON error body, keep default message */
    }
    throw new ApiError(message, res.status)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  signup: (name: string, email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: AuthUser }>('/auth/me'),

  listHistory: (toolId?: string) => request<{ items: HistoryItem[] }>(`/history${toolId ? `?toolId=${encodeURIComponent(toolId)}` : ''}`),
  uploadHistory: (toolId: string, toolName: string, outputName: string, blob: Blob) => {
    const form = new FormData()
    form.append('file', blob, outputName)
    form.append('toolId', toolId)
    form.append('toolName', toolName)
    form.append('outputName', outputName)
    return request<{ item: HistoryItem }>('/history', { method: 'POST', body: form })
  },
  deleteHistory: (id: string) => request<void>(`/history/${id}`, { method: 'DELETE' }),
  downloadHistoryBlob: async (item: { id: string }) => {
    const token = getToken()
    const headers = new Headers()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch(`${API_BASE}/api/history/${item.id}/download`, { headers })
    if (!res.ok) throw new ApiError('Could not download this file', res.status)
    return res.blob()
  },

  adminStats: () =>
    request<{ userCount: number; fileCount: number; totalBytes: number; byTool: { toolId: string; toolName: string; count: number }[] }>('/admin/stats'),
  adminUsers: () => request<{ users: (AuthUser & { fileCount: number })[] }>('/admin/users'),
  adminHistory: (userId?: string) => request<{ items: AdminHistoryItem[] }>(`/admin/history${userId ? `?userId=${userId}` : ''}`),
  adminDeleteHistory: (id: string) => request<void>(`/admin/history/${id}`, { method: 'DELETE' }),
  adminDeleteUser: (id: string) => request<void>(`/admin/users/${id}`, { method: 'DELETE' }),
  adminSetRole: (id: string, role: 'user' | 'admin') =>
    request<{ user: AuthUser }>(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
}
