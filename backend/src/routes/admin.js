import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { requireAuth, requireAdmin, publicUser } from '../auth.js'
import { bucket } from '../db.js'

export default function adminRoutes(users, history) {
  const router = Router()
  const auth = requireAuth(users)

  router.use(auth, requireAdmin)

  router.get('/stats', async (_req, res) => {
    const [userCount, fileCount, totalsAgg, byTool] = await Promise.all([
      users.countDocuments(),
      history.countDocuments(),
      history.aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }]).toArray(),
      history
        .aggregate([
          { $group: { _id: { toolId: '$toolId', toolName: '$toolName' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { _id: 0, toolId: '$_id.toolId', toolName: '$_id.toolName', count: 1 } },
        ])
        .toArray(),
    ])
    res.json({ userCount, fileCount, totalBytes: totalsAgg[0]?.total ?? 0, byTool })
  })

  router.get('/users', async (_req, res) => {
    const rows = await users
      .aggregate([
        { $sort: { _id: 1 } },
        {
          $lookup: {
            from: 'history',
            localField: '_id',
            foreignField: 'userId',
            as: 'files',
          },
        },
        { $addFields: { fileCount: { $size: '$files' } } },
        { $project: { files: 0 } },
      ])
      .toArray()
    res.json({ users: rows.map((r) => ({ ...publicUser(r), fileCount: r.fileCount })) })
  })

  router.patch('/users/:id/role', async (req, res) => {
    const { role } = req.body ?? {}
    if (role !== 'user' && role !== 'admin') return res.status(400).json({ error: "role must be 'user' or 'admin'" })
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'User not found' })
    const target = await users.findOne({ _id: new ObjectId(req.params.id) })
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (String(target._id) === String(req.user._id) && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin access' })
    }
    await users.updateOne({ _id: target._id }, { $set: { role } })
    res.json({ user: publicUser({ ...target, role }) })
  })

  router.delete('/users/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'User not found' })
    const target = await users.findOne({ _id: new ObjectId(req.params.id) })
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (String(target._id) === String(req.user._id)) return res.status(400).json({ error: 'You cannot delete your own account' })

    const files = await history.find({ userId: target._id }).toArray()
    await history.deleteMany({ userId: target._id })
    await users.deleteOne({ _id: target._id })
    await Promise.all(files.map((f) => bucket.delete(f.fileId).catch(() => {})))
    res.status(204).end()
  })

  router.get('/history', async (req, res) => {
    const { userId } = req.query
    const match = userId && ObjectId.isValid(userId) ? { userId: new ObjectId(userId) } : {}
    const rows = await history
      .aggregate([
        { $match: match },
        { $sort: { _id: -1 } },
        { $limit: 500 },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      ])
      .toArray()
    res.json({
      items: rows.map((row) => ({
        id: row._id.toString(),
        toolId: row.toolId,
        toolName: row.toolName,
        outputName: row.outputName,
        size: row.size,
        createdAt: row.createdAt,
        downloadUrl: `/api/history/${row._id.toString()}/download`,
        user: row.user ? { id: row.user._id.toString(), name: row.user.name, email: row.user.email } : null,
      })),
    })
  })

  router.delete('/history/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Not found' })
    const doc = await history.findOne({ _id: new ObjectId(req.params.id) })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    await history.deleteOne({ _id: doc._id })
    try {
      await bucket.delete(doc.fileId)
    } catch {
      /* already gone */
    }
    res.status(204).end()
  })

  return router
}
