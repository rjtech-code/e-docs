import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, type HistoryItem } from '../lib/api'

/**
 * Per-tool file history for the signed-in user. Guests get an inert version of this hook
 * (nothing is fetched or saved) so every tool page can call it unconditionally.
 */
export function useToolHistory(toolId: string, toolName: string) {
  const { user } = useAuth()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const { items } = await api.listHistory(toolId)
      setItems(items)
    } catch {
      /* history is a convenience feature — silently ignore fetch failures */
    } finally {
      setLoading(false)
    }
  }, [user, toolId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Fire-and-forget: don't block the user's download on the save, and never surface a
  // failure to save history as an error in the tool itself.
  const saveResult = useCallback(
    (blob: Blob, outputName: string) => {
      if (!user) return
      api
        .uploadHistory(toolId, toolName, outputName, blob)
        .then(() => refresh())
        .catch(() => {})
    },
    [user, toolId, toolName, refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      try {
        await api.deleteHistory(id)
      } catch {
        refresh()
      }
    },
    [refresh],
  )

  const download = useCallback(async (item: HistoryItem) => {
    const { downloadBlob } = await import('../lib/pdfCore')
    const blob = await api.downloadHistoryBlob(item)
    downloadBlob(blob, item.outputName)
  }, [])

  return { items, loading, saveResult, remove, download, signedIn: !!user }
}
