import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { signToken, requireAuth, publicUser } from '../auth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function authRoutes(users) {
  const router = Router()

  router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body ?? {}
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' })
    }
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const normalizedEmail = email.toLowerCase().trim()
    const existing = await users.findOne({ email: normalizedEmail })
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' })

    const passwordHash = bcrypt.hashSync(password, 10)
    const doc = { name: name.trim(), email: normalizedEmail, passwordHash, role: 'user', createdAt: new Date() }
    const { insertedId } = await users.insertOne(doc)
    const user = { ...doc, _id: insertedId }
    const token = signToken(user)
    res.status(201).json({ token, user: publicUser(user) })
  })

  router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {}
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

    const user = await users.findOne({ email: email.toLowerCase().trim() })
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    const token = signToken(user)
    res.json({ token, user: publicUser(user) })
  })

  router.get('/me', requireAuth(users), (req, res) => {
    res.json({ user: publicUser(req.user) })
  })

  return router
}
