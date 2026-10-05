import { Router } from 'express'
import multer from 'multer'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Server-side document conversion. Office <-> PDF is done by LibreOffice (headless) so the
// output keeps the original layout, fonts, images and tables; PDF -> Word / Excel use small
// Python helpers (pdf2docx, pdfplumber). Needs no database, so it is mounted before the
// db-ready gate in index.js. If the engines are not installed on the host (e.g. Vercel
// serverless), GET /api/convert/status reports it and the frontend falls back to its
// in-browser converters.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONVERTERS_DIR = path.join(__dirname, '..', '..', 'converters')

const MAX_UPLOAD_BYTES = Number(process.env.CONVERT_MAX_MB || 50) * 1024 * 1024
const TIMEOUT_MS = Number(process.env.CONVERT_TIMEOUT_MS || 120_000)
const MAX_CONCURRENT = Number(process.env.CONVERT_CONCURRENCY || 2)
const MAX_QUEUED = Number(process.env.CONVERT_MAX_QUEUE || 20)
const SOFFICE_BIN = process.env.SOFFICE_PATH || 'soffice'
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3'

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

// kind -> how to convert. `engine` is 'office' (LibreOffice) or 'python' (script in converters/).
const KINDS = {
  'word-to-pdf': { engine: 'office', inputs: ['docx', 'doc', 'odt', 'rtf'], output: 'pdf', filter: 'pdf:writer_pdf_Export' },
  'powerpoint-to-pdf': { engine: 'office', inputs: ['pptx', 'ppt', 'odp'], output: 'pdf', filter: 'pdf:impress_pdf_Export' },
  'excel-to-pdf': { engine: 'office', inputs: ['xlsx', 'xls', 'ods', 'csv'], output: 'pdf', filter: 'pdf:calc_pdf_Export' },
  'pdf-to-powerpoint': {
    engine: 'office',
    inputs: ['pdf'],
    output: 'pptx',
    filter: 'pptx:Impress MS PowerPoint 2007 XML',
    infilter: 'impress_pdf_import',
  },
  'pdf-to-word': { engine: 'python', inputs: ['pdf'], output: 'docx', script: 'pdf_to_docx.py' },
  'pdf-to-excel': { engine: 'python', inputs: ['pdf'], output: 'xlsx', script: 'pdf_to_xlsx.py' },
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/* ---------- tiny job queue: LibreOffice is heavy, so cap how many run at once ---------- */
let running = 0
const waiting = []
function acquire() {
  if (running < MAX_CONCURRENT) {
    running++
    return Promise.resolve()
  }
  if (waiting.length >= MAX_QUEUED) {
    return Promise.reject(new HttpError(503, 'Server is busy converting other files — please try again in a minute'))
  }
  return new Promise((resolve) => waiting.push(resolve))
}
function release() {
  const next = waiting.shift()
  if (next) next()
  else running--
}

/* ---------- process helper (timeout kills the whole process group) ---------- */
function run(cmd, args, { timeout = TIMEOUT_MS, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { detached: process.platform !== 'win32', env: { ...process.env, ...env } })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      try {
        process.platform === 'win32' ? child.kill('SIGKILL') : process.kill(-child.pid, 'SIGKILL')
      } catch {
        /* already gone */
      }
      settled = true
      reject(new HttpError(504, 'Conversion took too long and was stopped'))
    }, timeout)
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${cmd} exited with code ${code}: ${stderr || stdout}`.slice(0, 600)))
    })
  })
}

/* ---------- engine availability (cached) ---------- */
let availability = null
let availabilityAt = 0
async function checkAvailability() {
  if (availability && Date.now() - availabilityAt < 60_000) return availability
  const probe = (cmd, args) => run(cmd, args, { timeout: 20_000 }).then(() => true, () => false)
  const [office, python] = await Promise.all([
    probe(SOFFICE_BIN, ['--version']),
    probe(PYTHON_BIN, ['-c', 'import pdf2docx, pdfplumber, openpyxl']),
  ])
  availability = { office, python }
  availabilityAt = Date.now()
  return availability
}
function kindsFor({ office, python }) {
  return Object.entries(KINDS)
    .filter(([, k]) => (k.engine === 'office' ? office : python))
    .map(([name]) => name)
}

/* ---------- input validation ---------- */
function extOf(name) {
  return path.extname(name || '').slice(1).toLowerCase()
}
function looksLikeInput(buf, ext) {
  if (ext === 'pdf') return buf.subarray(0, 5).toString('latin1') === '%PDF-'
  if (['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods'].includes(ext)) return buf[0] === 0x50 && buf[1] === 0x4b // "PK" zip
  if (['doc', 'ppt', 'xls'].includes(ext)) return buf[0] === 0xd0 && buf[1] === 0xcf // OLE2
  return true // rtf / csv are plain text
}

async function convertFile(kindName, buffer, ext) {
  const kind = KINDS[kindName]
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'edocs-'))
  const input = path.join(dir, `input.${ext}`)
  const output = path.join(dir, `output.${kind.output}`)
  try {
    await fs.writeFile(input, buffer)

    if (kind.engine === 'python') {
      await run(PYTHON_BIN, [path.join(CONVERTERS_DIR, kind.script), input, output])
    } else {
      // Fresh LibreOffice profile per job: avoids lock clashes between parallel conversions.
      const profile = pathToFileURL(path.join(dir, 'profile')).href
      const args = [`-env:UserInstallation=${profile}`, '--headless', '--norestore', '--nolockcheck']
      if (kind.infilter) args.push(`--infilter=${kind.infilter}`)
      args.push('--convert-to', kind.filter, '--outdir', dir, input)
      await run(SOFFICE_BIN, args, { env: { HOME: dir } })
      // LibreOffice names the result after the input: input.<ext> -> input.<output>
      await fs.rename(path.join(dir, `input.${kind.output}`), output)
    }

    const result = await fs.readFile(output)
    if (result.length === 0) throw new Error('Converter produced an empty file')
    return result
  } finally {
    fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

export default function convertRoutes() {
  const router = Router()
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } })

  router.get('/status', async (_req, res) => {
    const a = await checkAvailability()
    res.json({ available: a.office || a.python, office: a.office, python: a.python, kinds: kindsFor(a) })
  })

  router.post('/:kind', upload.single('file'), async (req, res, next) => {
    try {
      const kind = KINDS[req.params.kind]
      if (!kind) throw new HttpError(404, 'Unknown conversion')
      if (!req.file) throw new HttpError(400, 'No file uploaded')

      const ext = extOf(req.file.originalname)
      if (!kind.inputs.includes(ext)) {
        throw new HttpError(400, `This tool accepts: ${kind.inputs.map((e) => '.' + e).join(', ')}`)
      }
      if (!looksLikeInput(req.file.buffer, ext)) {
        throw new HttpError(400, 'The file looks corrupted or is not a real .' + ext + ' file')
      }

      const a = await checkAvailability()
      if (!kindsFor(a).includes(req.params.kind)) {
        throw new HttpError(503, 'Server-side conversion is not available on this server')
      }

      await acquire()
      let out
      try {
        out = await convertFile(req.params.kind, req.file.buffer, ext)
      } catch (err) {
        if (err instanceof HttpError) throw err
        console.error(`[convert:${req.params.kind}]`, err.message)
        throw new HttpError(422, 'Could not convert this file. It may be corrupted or password-protected.')
      } finally {
        release()
      }

      const base = path.basename(req.file.originalname, path.extname(req.file.originalname)) || 'converted'
      const filename = `${base}.${kind.output}`
      res.setHeader('Content-Type', MIME[kind.output])
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
      res.send(out)
    } catch (err) {
      next(err)
    }
  })

  return router
}
