import { z } from 'zod'

export const CreateTaskSchema = z.object({
  projectId: z.string().uuid(),
  description: z.string().min(1).max(2000),
  executionMode: z.enum(['automatic', 'semi-auto', 'manual']).default('semi-auto'),
  priority: z.number().int().min(1).max(5).default(3),
})

export const UpdateTaskStatusSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'paused', 'cancelled']),
})

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>
export type UpdateTaskStatusInput = z.infer<typeof UpdateTaskStatusSchema>
