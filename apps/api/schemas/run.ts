import { z } from 'zod'

export const CreateRunSchema = z.object({
  executionMode: z.enum(['automatic', 'semi-auto', 'manual']).default('semi-auto'),
})

export const RunEventSchema = z.object({
  level: z.enum(['info', 'warn', 'error', 'debug']).default('info'),
  agent: z.string().max(50),
  message: z.string().max(2000),
  metadata: z.record(z.unknown()).optional(),
})

export const FileChangeSchema = z.object({
  path: z.string().max(500),
  status: z.enum(['added', 'modified', 'deleted']),
  additions: z.number().int().min(0).default(0),
  deletions: z.number().int().min(0).default(0),
  diffContent: z.string().optional(),
})

export type CreateRunInput = z.infer<typeof CreateRunSchema>
export type RunEventInput = z.infer<typeof RunEventSchema>
export type FileChangeInput = z.infer<typeof FileChangeSchema>
