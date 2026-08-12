import { z } from 'zod'

export const CreateApprovalSchema = z.object({
  type: z.enum(['code-review', 'deployment', 'security-check']),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  requestedBy: z.string().max(50),
})

export const ResolveApprovalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
})

export type CreateApprovalInput = z.infer<typeof CreateApprovalSchema>
export type ResolveApprovalInput = z.infer<typeof ResolveApprovalSchema>
