import { Router } from 'express'
import multer from 'multer'
import { ObjectId } from 'mongodb'
import { requireAuth } from '../auth.js'
import { bucket } from '../db.js'

const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100MB per saved file is generous for PDFs/office docs

function toRecord(doc) {
  return {
    id: doc._id.toString(),
    toolId: doc.toolId,
    toolName: doc.toolName,
    outputName: doc.outputName,
    mimeType: doc.mimeType,
    size: doc.size,
    createdAt: doc.createdAt,
    downloadUrl: `/api/history/${doc._id.toString()}/download`,
  }
}

/** Upload a Buffer into the GridFS bucket, resolving with the new file's ObjectId. */
function uploadToGridFs(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, { contentType })
    uploadStream.on('error', reject)
    uploadStream.on('finish', () => resolve(uploadStream.id))
    uploadStream.end(buffer)
  })
}

export default function historyRoutes(users, history) {
  const router = Router()
  const auth = requireAuth(users)
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } })

  router.post('/', auth, upload.single('file'), async (req, res) => {
    const { toolId, toolName, outputName } = req.body ?? {}
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    if (!toolId || !toolName || !outputName) {
      return res.status(400).json({ error: 'toolId, toolName and outputName are required' })
    }

    const mimeType = req.file.mimetype || 'application/octet-stream'
    const fileId = await uploadToGridFs(req.file.buffer, String(outputName), mimeType)

    const doc = {
      userId: req.user._id,
      toolId: String(toolId),
      toolName: String(toolName),
      outputName: String(outputName),
      mimeType,
      size: req.file.size,
      fileId,
      createdAt: new Date(),
    }
    const { insertedId } = await history.insertOne(doc)
    res.status(201).json({ item: toRecord({ ...doc, _id: insertedId }) })
  })

  router.get('/', auth, async (req, res) => {
    const { toolId } = req.query
    const query = toolId ? { userId: req.user._id, toolId: String(toolId) } : { userId: req.user._id }
    const docs = await history.find(query).sort({ _id: -1 }).toArray()
    res.json({ items: docs.map(toRecord) })
  })

  router.get('/:id/download', auth, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Not found' })
    const doc = await history.findOne({ _id: new ObjectId(req.params.id) })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    if (String(doc.userId) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.outputName)}`)
    res.setHeader('Content-Type', doc.mimeType)
    bucket
      .openDownloadStream(doc.fileId)
      .on('error', () => res.status(404).json({ error: 'File no longer available' }))
      .pipe(res)
  })

  router.delete('/:id', auth, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Not found' })
    const doc = await history.findOne({ _id: new ObjectId(req.params.id) })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    if (String(doc.userId) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await history.deleteOne({ _id: doc._id })
    try {
      await bucket.delete(doc.fileId)
    } catch {
      /* file already gone from GridFS — history row is what matters to the user */
    }
    res.status(204).end()
  })

  return router
}
