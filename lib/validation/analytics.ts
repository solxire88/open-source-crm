import { z } from 'zod'

import { uuidSchema } from '@/lib/validation/common'

export const analyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
  tableIds: z.string().optional(),
  ownerId: uuidSchema.optional(),
})
