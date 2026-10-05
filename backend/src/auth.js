import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'

// Loaded from backend/.env (see src/env.js, imported first by src/index.js) — auto-created
// with a random value on first run, so this is always set by the time this module loads.
export const JWT_SECRET = process.env.JWT_SECRET

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: '30d' })
}

export function requireAuth(users) {
  return async (req, res, next) => {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Not authenticated' })
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      if (!ObjectId.isValid(payload.sub)) return res.status(401).json({ error: 'Not authenticated' })
      const user = await users.findOne({ _id: new ObjectId(payload.sub) })
      if (!user) return res.status(401).json({ error: 'Not authenticated' })
      req.user = user
      next()
    } catch {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

export function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }
}
