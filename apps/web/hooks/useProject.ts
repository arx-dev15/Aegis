/**
 * useProject — fetches a single project + its tasks in parallel
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { projectApi, ApiProject, ApiTask } from '@/lib/api'

export function useProject(id: string) {
  const [project, setProject] = useState<ApiProject | null>(null)
  const [tasks, setTasks]     = useState<ApiTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [proj, taskList] = await Promise.all([
        projectApi.get(id),
        projectApi.tasks(id),
      ])
      setProject(proj)
      setTasks(taskList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  return { project, tasks, loading, error, refetch: load }
}
