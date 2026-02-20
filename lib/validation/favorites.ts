import { z } from 'zod'

import { uuidSchema } from '@/lib/validation/common'

export const favoriteTablesPutSchema = z.object({
  table_ids: z.array(uuidSchema).max(500),
})

