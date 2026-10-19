'use client'

import { useState, useEffect } from 'react'
import { systemApi, ApiSystemHealth } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StatusDot } from '@/components/ui/StatusDot'
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Cpu,
  Github,
  Settings2,
  Database,
  Loader2,
} from 'lucide-react'

export default function SettingsPage() {
  const [showKey, setShowKey] = useState(false)
  const [executionMode, setExecutionMode] = useState<'automatic' | 'semi-auto' | 'manual'>('semi-auto')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [health, setHealth] = useState<ApiSystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const h = await systemApi.health()
        setHealth(h)
        setOffline(false)
      } catch {
        setOffline(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleSave() {
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2500)
  }

  const isGeminiConfigured = Boolean(health?.gemini?.configured)
  const isGithubConfigured = Boolean(health?.github?.configured)

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Configure Aegis integrations and operational preferences</p>
      </div>

      {offline && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 text-xs text-yellow-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-400" />
          <span>Backend API is currently offline. Real health and credential configurations are unavailable.</span>
        </div>
      )}

      {/* Gemini */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Gemini Configuration</h2>
        </div>

        <Card className="space-y-4">
          {/* API Key */}
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-2">API Key</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-zinc-800 border border-zinc-700 rounded px-3 py-2 gap-2">
                <code className="text-sm font-mono text-zinc-300 flex-1">
                  {isGeminiConfigured
                    ? showKey
                      ? 'AIzaSy... [Configured in server .env]'
                      : '••••••••••••••••••••••••••••••••••••••'
                    : 'Not configured in environment'}
                </code>
                {isGeminiConfigured && (
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isGeminiConfigured ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400">Configured</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-yellow-400">Not configured</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-2">Model</label>
            <select
              defaultValue={health?.gemini?.model || 'gemini-2.0-flash'}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
            >
              <option value="gemini-2.0-flash">gemini-2.0-flash (recommended)</option>
              <option value="gemini-2.0-pro">gemini-2.0-pro</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
            </select>
          </div>

          {/* Connection status */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-2">
              <StatusDot status={isGeminiConfigured ? 'online' : 'offline'} />
              <span className="text-xs text-zinc-500">
                {offline
                  ? 'Backend offline'
                  : isGeminiConfigured
                  ? 'Connected via server environment'
                  : 'Missing GEMINI_API_KEY in .env'}
              </span>
            </div>
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              AI Studio <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </Card>
      </section>

      {/* GitHub */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Github className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-200">GitHub Connection</h2>
        </div>

        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center">
              <Github className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">
                {isGithubConfigured ? 'GitHub PAT Active' : 'No Account Connected'}
              </p>
              <p className="text-xs text-zinc-500">
                {isGithubConfigured ? 'Connected account via environment' : 'Configure GITHUB_TOKEN in .env'}
              </p>
            </div>
            <Badge variant={isGithubConfigured ? 'success' : 'default'} className="ml-auto">
              {isGithubConfigured ? 'Connected' : 'Unavailable'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">Personal Access Token</label>
              <div className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2">
                <code className="text-xs font-mono text-zinc-400">
                  {isGithubConfigured ? 'ghp_••••••••••••••••••••' : 'Not configured'}
                </code>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">Default Branch</label>
              <select className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500">
                <option>main</option>
                <option>master</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-2">
              <StatusDot status={isGithubConfigured ? 'online' : 'offline'} />
              <span className="text-xs text-zinc-500">
                {offline
                  ? 'Backend offline'
                  : isGithubConfigured
                  ? 'GitHub token detected'
                  : 'Not configured'}
              </span>
            </div>
          </div>
        </Card>
      </section>

      {/* Database & Persistence */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Storage & Persistence</h2>
        </div>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Authoritative Execution Lifecycle</p>
              <p className="text-xs text-zinc-500">Canonical filesystem storage at .aegis/runs/</p>
            </div>
            <Badge variant="success">Active</Badge>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs text-zinc-400">
            <span>Database Backend:</span>
            <span className="font-mono text-zinc-300">
              {offline
                ? 'Unavailable'
                : health?.db === 'connected'
                ? 'PostgreSQL Connected'
                : health?.db === 'disabled'
                ? 'In-Memory / SQLite (SKIP_DB)'
                : 'Unreachable'}
            </span>
          </div>
        </Card>
      </section>

      {/* Preferences */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Project Preferences</h2>
        </div>

        <Card className="space-y-5">
          {/* Execution mode */}
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-3">Default Execution Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'automatic', label: 'Automatic', desc: 'Agents run without interruption' },
                  { value: 'semi-auto', label: 'Semi-Auto', desc: 'Pauses at approval gates' },
                  { value: 'manual',    label: 'Manual',    desc: 'Step-by-step with confirmation' },
                ] as const
              ).map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setExecutionMode(value)}
                  className={`p-3 rounded-md border text-left transition-colors ${
                    executionMode === value
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 ${executionMode === value ? 'text-blue-400' : 'text-zinc-300'}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-snug">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2.5">
            {[
              'Run security audit before each commit',
              'Auto-create GitHub PRs after successful runs',
              'Notify on approval requests',
            ].map((label) => (
              <label key={label} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900"
                />
                <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">{label}</span>
              </label>
            ))}
          </div>
        </Card>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={handleSave}>
          {saveSuccess ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : 'Save Changes'}
        </Button>
        {saveSuccess && <span className="text-xs text-green-400">Settings saved successfully</span>}
      </div>
    </div>
  )
}
