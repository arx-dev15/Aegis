'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { mockProjects } from '@/data/mock'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Zap, ChevronDown } from 'lucide-react'
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
  const [projectId, setProjectId] = useState(mockProjects[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<ExecutionMode>('semi-auto')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setIsSubmitting(true)
    // Simulate API call
    await new Promise((res) => setTimeout(res, 1200))
    setIsSubmitting(false)
    setSubmitted(true)
    setTimeout(() => {
      router.push('/tasks/run-001')
    }, 800)
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-green-400" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100 mb-1">Task queued!</h2>
          <p className="text-sm text-zinc-500">Redirecting to agent run...</p>
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

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Project selector */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">Project</label>
          <div className="relative">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 pr-9 transition-colors"
            >
              {mockProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.repo}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          </div>
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
            <p className="text-xs text-zinc-500 mt-0.5">
              7 agents will be orchestrated in sequence
            </p>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={!description.trim()}
          >
            <Zap className="w-4 h-4" />
            Launch Task
          </Button>
        </Card>
      </form>
    </div>
  )
}
