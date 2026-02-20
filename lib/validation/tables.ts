import { z } from 'zod'

import {
  ACCESS_LEVEL_VALUES,
  SOURCE_TYPE_VALUES,
  STAGE_VALUES,
} from '@/lib/backend-types'
import { uuidSchema } from '@/lib/validation/common'

const requiredNameSchema = z.string().trim().min(1).max(120)

export const tableCreateSchema = z.object({
  name: requiredNameSchema,
  default_stage: z.enum(STAGE_VALUES).optional(),
  default_source_type: z.enum(SOURCE_TYPE_VALUES).nullable().optional(),
  default_source_detail: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional(),
})

export const tableUpdateSchema = z
  .object({
    name: requiredNameSchema.optional(),
    is_archived: z.boolean().optional(),
    default_stage: z.enum(STAGE_VALUES).optional(),
    default_source_type: z.enum(SOURCE_TYPE_VALUES).nullable().optional(),
    default_source_detail: z
      .string()
      .trim()
      .max(300)
      .nullable()
      .optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided',
  })

export const tablePermissionEntrySchema = z.object({
  user_id: uuidSchema,
  access_level: z.enum(ACCESS_LEVEL_VALUES),
})

export const tablePermissionPutSchema = z.array(tablePermissionEntrySchema)
