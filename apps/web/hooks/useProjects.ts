/**
 * useProjects — fetches all projects from the API
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { projectApi, ApiProject } from '@/lib/api'

export function useProjects() {
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProjects(await projectApi.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { projects, loading, error, refetch: load }
}
