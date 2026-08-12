/**
 * useRun — fetches the most recent run for a task ID.
 * Calls GET /api/tasks/:taskId/runs and picks the first result.
 * Each run includes embedded events[] and files[] in SKIP_DB mode.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { runApi, ApiRun } from '@/lib/api'

export function useRun(taskId: string) {
  const [run, setRun]         = useState<ApiRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!taskId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const runs = await runApi.listForTask(taskId)
      setRun(runs.length > 0 ? runs[0] : null)
    } catch (err) {
      // 404 or empty = task has no runs yet, not an error
      if (err instanceof Error && (err.message.includes('404') || err.message.includes('not found'))) {
        setRun(null)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load run')
      }
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => { load() }, [load])

  return { run, loading, error, refetch: load }
}
