/**
 * useRun — fetches the most recent run for a task ID.
 * Calls GET /api/tasks/:taskId/runs and picks the first result.
 * Includes bounded polling for active execution states and clean refresh reconstruction.
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
    setError(null)
    try {
      const runs = await runApi.listForTask(taskId)
      if (runs && runs.length > 0) {
        setRun(runs[0])
      } else {
        // Fallback: check if taskId is a direct run ID
        try {
          const directRun = await runApi.get(taskId)
          setRun(directRun)
        } catch {
          setRun(null)
        }
      }
    } catch (err) {
      // Fallback: check if taskId is a direct run ID
      try {
        const directRun = await runApi.get(taskId)
        setRun(directRun)
      } catch {
        if (err instanceof Error && (err.message.includes('404') || err.message.includes('not found'))) {
          setRun(null)
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load run')
        }
      }
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => { load() }, [load])

  // Bounded polling while run is active or paused at approval gate
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    const isActive = run?.status === 'running' || run?.status === 'pending' || run?.status === 'paused'
    if (isActive) {
      timer = setInterval(() => {
        load()
      }, 2000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [run?.status, load])

  return { run, loading, error, refetch: load }
}
