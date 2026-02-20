import { z } from 'zod'

export const uuidSchema = z.string().uuid()

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const includeFlagSchema = z
  .union([z.literal('1'), z.literal('0')])
  .optional()

export const booleanFromFlag = (value: string | null | undefined, defaultValue = false) => {
  if (value == null) return defaultValue
  return value === '1' || value.toLowerCase() === 'true'
}

export const csvListSchema = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )

export const nonEmptyTrimmed = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, {
    message: 'Value is required',
  })
