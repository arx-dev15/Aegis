/**
 * useActivity — fetches recent activity feed from the API.
 * Starts with loading: false so it never blocks page render —
 * activity is a secondary feed, not required for the page to display.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { activityApi, ApiActivity } from '@/lib/api'

export function useActivity(limit = 50) {
  const [activity, setActivity] = useState<ApiActivity[]>([])
  const [loading, setLoading]   = useState(false)  // false — doesn't block page render
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setActivity(await activityApi.list(limit))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
      setActivity([])
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => { load() }, [load])

  return { activity, loading, error, refetch: load }
}
