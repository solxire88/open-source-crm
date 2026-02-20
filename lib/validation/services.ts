import { z } from 'zod'

const serviceNameSchema = z.string().trim().min(1).max(120)

export const serviceCreateSchema = z.object({
  name: serviceNameSchema,
})

export const serviceUpdateSchema = z
  .object({
    name: serviceNameSchema.optional(),
    is_archived: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided',
  })
