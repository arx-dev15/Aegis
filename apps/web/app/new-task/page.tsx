'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { projectApi, taskApi } from '@/lib/api'
import type { ApiProject } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Zap, ChevronDown, Loader2, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

type ExecutionMode = 'automatic' | 'semi-auto' | 'manual'

const modes: { value: ExecutionMode; label: string; description: string }[] = [
  {
    value: 'automatic',
    label: 'Automatic',
    description: 'Agents run end-to-end without interruption. Ideal for well-defined tasks.',
  },
  {
    value: 'semi-auto',
    label: 'Semi-Auto',
    description: 'Pauses at approval gates. Recommended — you stay in the loop at key decisions.',
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'Step-by-step with confirmation at every agent transition. Full control.',
  },
]

export default function NewTaskPage() {
  const router = useRouter()

  // Form state
  const [projectId, setProjectId]     = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode]               = useState<ExecutionMode>('semi-auto')
  const [priority, setPriority]       = useState(3)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null)

  // Projects dropdown
  const [projects, setProjects]         = useState<ApiProject[]>([])
  const [projLoading, setProjLoading]   = useState(true)
  const [projError, setProjError]       = useState<string | null>(null)

  // Load projects for the dropdown
  useEffect(() => {
    projectApi.list()
      .then((data) => {
        setProjects(data)
        if (data.length > 0) setProjectId(data[0].id)
      })
      .catch((err) => setProjError(err instanceof Error ? err.message : 'Failed to load projects'))
      .finally(() => setProjLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim() || !projectId) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // 1. Create the task
      const task = await taskApi.create({
        projectId,
        description: description.trim(),
        executionMode: mode,
        priority,
      })

      setCreatedTaskId(task.id)
      setSubmitted(true)

      // 2. Redirect to the task page after a short delay
      setTimeout(() => router.push(`/tasks/${task.id}`), 900)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Success screen
  if (submitted) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-green-400" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100 mb-1">Task created!</h2>
          <p className="text-sm text-zinc-500">
            Redirecting to task {createdTaskId ? `#${createdTaskId.slice(0, 8)}…` : ''}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">New Task</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Describe what you want Aegis to build, fix, or refactor.
        </p>
      </div>

      {/* Error banner */}
      {submitError && (
        <div className="mb-5 flex items-start gap-2 px-3 py-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Project selector */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">Project</label>
          {projLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading projects...
            </div>
          ) : projError ? (
            <p className="text-sm text-red-400">{projError}</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No projects found.{' '}
              <a href="/projects" className="text-blue-400 hover:text-blue-300">Create one first.</a>
            </p>
          ) : (
            <div className="relative">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 pr-9 transition-colors"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.repo ? ` — ${p.repo}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Task description */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">
            Task Description <span className="text-zinc-600">(required)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Implement rate limiting middleware with Redis using a sliding window algorithm. Add unit tests and update the .env.example with required variables."
            rows={6}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none transition-colors leading-relaxed"
          />
          <div className="flex justify-between mt-1.5">
            <p className="text-xs text-zinc-600">Be specific — the more detail, the better the output.</p>
            <span className="text-xs text-zinc-600">{description.length} chars</span>
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">
            Priority <span className="text-zinc-600">(1 = low, 5 = critical)</span>
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={clsx(
                  'w-9 h-9 rounded-md text-sm font-medium border transition-colors',
                  priority === p
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Execution mode */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-3">Execution Mode</label>
          <div className="space-y-2">
            {modes.map(({ value, label, description: desc }) => (
              <label
                key={value}
                className={clsx(
                  'flex items-start gap-3 p-3.5 rounded-md border cursor-pointer transition-colors',
                  mode === value
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600',
                )}
              >
                <div className="mt-0.5 shrink-0">
                  <div
                    className={clsx(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      mode === value ? 'border-blue-500' : 'border-zinc-600',
                    )}
                  >
                    {mode === value && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                </div>
                <div className="flex-1">
                  <div className={clsx('text-sm font-medium', mode === value ? 'text-blue-300' : 'text-zinc-300')}>
                    {label}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 leading-snug">{desc}</div>
                </div>
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-300">Ready to run</p>
            <p className="text-xs text-zinc-500 mt-0.5">7 agents will be orchestrated in sequence</p>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={!description.trim() || !projectId || projLoading}
          >
            <Zap className="w-4 h-4" />
            Launch Task
          </Button>
        </Card>
      </form>
    </div>
  )
}
