import { z } from 'zod'

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  repo: z.string().max(200).default(''),
  branch: z.string().max(100).default('main'),
  techStack: z.array(z.string()).default([]),
  language: z.string().max(50).default(''),
})

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  status: z.enum(['active', 'paused', 'archived']).optional(),
})

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>
