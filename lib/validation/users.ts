import { z } from 'zod'

import { paginationSchema } from '@/lib/validation/common'

export const usersListQuerySchema = z.object({
  limit: paginationSchema.shape.limit,
  offset: paginationSchema.shape.offset,
})

