import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

// Any real host (Vercel, Render, Railway, ...) injects its Project/Service env vars
// straight into process.env before the process starts, and usually has no writable,
// persistent place for a .env file anyway — so if MONGODB_URI is already set (by the
// host, or by whoever launched this process), there's nothing for this file to do.
// This local-only auto-.env is purely a "just clone and run" convenience for `npm run dev`.
const isManagedHost = Boolean(process.env.VERCEL || process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.MONGODB_URI)

if (!isManagedHost) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const envPath = path.join(__dirname, '..', '.env')

  // Zero-config by default: if there's no .env yet, create one with a random JWT secret
  // so login sessions survive server restarts (see backend/.env.example for what this holds).
  if (!fs.existsSync(envPath)) {
    const secret = crypto.randomBytes(48).toString('hex')
    fs.writeFileSync(
      envPath,
      `PORT=8787\nJWT_SECRET=${secret}\nMONGODB_URI=mongodb://127.0.0.1:27017/sikshapaper\nFRONTEND_ORIGIN=http://localhost:5173\n`,
    )
    console.log('Created backend/.env with a generated JWT_SECRET and a default local MONGODB_URI (edit it any time).')
  }

  process.loadEnvFile(envPath)
}
