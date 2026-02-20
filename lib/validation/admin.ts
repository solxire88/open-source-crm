import { z } from 'zod'

import { ROLE_VALUES } from '@/lib/backend-types'
import { uuidSchema } from '@/lib/validation/common'

export const adminCreateUserSchema = z
  .object({
    email: z.string().trim().email().max(320),
    display_name: z.string().trim().min(1).max(120),
    role: z.enum(ROLE_VALUES).default('sales'),
    temp_password: z.string().min(8).max(128).optional(),
    invite: z.boolean().optional(),
  })
  .refine((payload) => payload.invite || payload.temp_password, {
    message: 'Provide temp_password or set invite=true',
    path: ['temp_password'],
  })

export const adminPatchUserSchema = z
  .object({
    display_name: z.string().trim().min(1).max(120).optional(),
    role: z.enum(ROLE_VALUES).optional(),
    is_disabled: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided',
  })

export const adminReassignLeadsSchema = z.object({
  to_user_id: uuidSchema.nullable(),
})
