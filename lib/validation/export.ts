import { z } from 'zod'

export const exportQuerySchema = z.object({
  template: z.enum(['full', 'calling', 'source_report', 'services_report']).default('full'),
  includeArchived: z.union([z.literal('1'), z.literal('0')]).optional(),
  includeDnc: z.union([z.literal('1'), z.literal('0')]).optional(),
})
