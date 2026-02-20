import { z } from 'zod'

import { SOURCE_TYPE_VALUES, STAGE_VALUES } from '@/lib/backend-types'

export const csvImportConfigSchema = z.object({
  mapping: z
    .object({
      business_name: z.string().optional(),
      stage: z.string().optional(),
      contact: z.string().optional(),
      website_url: z.string().optional(),
      notes: z.string().optional(),
      source_type: z.string().optional(),
      source_detail: z.string().optional(),
      owner_id: z.string().optional(),
      next_followup_at: z.string().optional(),
      do_not_contact: z.string().optional(),
      dnc_reason: z.string().optional(),
      lost_reason: z.string().optional(),
    })
    .optional(),
  default_stage: z.enum(STAGE_VALUES).optional(),
  default_source_type: z.enum(SOURCE_TYPE_VALUES).optional(),
  default_source_detail: z.string().trim().max(300).optional(),
})

export const csvImportStorageRequestSchema = z.object({
  storage_path: z.string().trim().min(1),
  config: csvImportConfigSchema.optional(),
})
