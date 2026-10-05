import { MongoClient, GridFSBucket } from 'mongodb'
import bcrypt from 'bcryptjs'

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sikshapaper'
const client = new MongoClient(uri)

export const mongo = client
export const db = client.db() // uses the database named in the URI (sikshapaper)
export const users = db.collection('users')
export const history = db.collection('history')
/** GridFS bucket — every saved PDF/DOCX/... file's actual bytes live here, in MongoDB itself. */
export const bucket = new GridFSBucket(db, { bucketName: 'files' })

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Connects to MongoDB with retries (instead of a blocking top-level await) so the HTTP
 * server can start — and Render/Vercel/etc. see an open port — even while MongoDB is
 * briefly unreachable (e.g. first-boot connectivity hiccups, IP allowlist propagating).
 * Resolves once connected; index.js only marks the API "ready" after this resolves.
 */
export async function connectDB({ retries = Infinity, delayMs = 5000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      await client.connect()
      break
    } catch (err) {
      if (attempt >= retries) throw err
      console.error(`MongoDB connection attempt ${attempt} failed: ${err.message} — retrying in ${delayMs / 1000}s`)
      await sleep(delayMs)
    }
  }

  await users.createIndex({ email: 1 }, { unique: true })
  await history.createIndex({ userId: 1 })
  await history.createIndex({ userId: 1, toolId: 1 })

  console.log(`Connected to MongoDB at ${uri}`)

  // Seed a default admin account on first run so there's always a way into the admin panel.
  const adminEmail = 'admin@sikshapaper.local'
  const existingAdmin = await users.findOne({ email: adminEmail })
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync('admin123', 10)
    await users.insertOne({ name: 'Admin', email: adminEmail, passwordHash, role: 'admin', createdAt: new Date() })
    console.log(`Seeded default admin account -> email: ${adminEmail}  password: admin123 (please change this)`)
  }
}
