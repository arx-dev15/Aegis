/**
 * useTask — fetches a single task by ID
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { taskApi, ApiTask } from '@/lib/api'

export function useTask(id: string) {
  const [task, setTask]       = useState<ApiTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      setTask(await taskApi.get(id))
    } catch (err) {
      // 404 = task doesn't exist — not a hard error, just null
      if (err instanceof Error && err.message.includes('404')) {
        setTask(null)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load task')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  return { task, loading, error, refetch: load }
}
