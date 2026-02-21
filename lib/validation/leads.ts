import { z } from 'zod'

import {
  FOLLOWUP_WINDOW_VALUES,
  SOURCE_TYPE_VALUES,
  STAGE_VALUES,
} from '@/lib/backend-types'
import { paginationSchema, uuidSchema } from '@/lib/validation/common'

const nullableTrimmedString = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value == null) return null
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  })
  .optional()

const stageSchema = z.enum(STAGE_VALUES)
const sourceTypeSchema = z.enum(SOURCE_TYPE_VALUES)
const followupWindowSchema = z.enum(FOLLOWUP_WINDOW_VALUES)

export const leadsListQuerySchema = z.object({
  view: z.enum(['new', 'my', 'due', 'pipeline', 'all']).default('all'),
  stage: stageSchema.optional(),
  ownerId: uuidSchema.optional(),
  q: z.string().trim().min(1).max(160).optional(),
  includeArchived: z.union([z.literal('1'), z.literal('0')]).optional(),
  includeDnc: z.union([z.literal('1'), z.literal('0')]).optional(),
  limit: paginationSchema.shape.limit,
  offset: paginationSchema.shape.offset,
})

export const leadCreateSchema = z.object({
  business_name: z.string().trim().min(1).max(180),
  stage: stageSchema.optional(),
  owner_id: uuidSchema.nullable().optional(),
  next_followup_at: z.string().date().nullable().optional(),
  followup_window: followupWindowSchema.optional(),
  contact: nullableTrimmedString,
  website_url: nullableTrimmedString,
  notes: nullableTrimmedString,
  source_type: sourceTypeSchema.optional(),
  source_detail: nullableTrimmedString,
  do_not_contact: z.boolean().optional(),
  dnc_reason: nullableTrimmedString,
  lost_reason: nullableTrimmedString,
  is_archived: z.boolean().optional(),
  service_ids: z.array(uuidSchema).optional(),
})

export const leadPatchSchema = z
  .object({
    business_name: z.string().trim().min(1).max(180).optional(),
    stage: stageSchema.optional(),
    owner_id: uuidSchema.nullable().optional(),
    next_followup_at: z.string().date().nullable().optional(),
    followup_window: followupWindowSchema.optional(),
    contact: nullableTrimmedString,
    website_url: nullableTrimmedString,
    notes: nullableTrimmedString,
    source_type: sourceTypeSchema.optional(),
    source_detail: nullableTrimmedString,
    do_not_contact: z.boolean().optional(),
    dnc_reason: nullableTrimmedString,
    lost_reason: nullableTrimmedString,
    is_archived: z.boolean().optional(),
    service_ids: z.array(uuidSchema).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided',
  })

export const claimLeadSchema = z
  .object({
    owner_id: uuidSchema.optional(),
  })
  .optional()

export const logTouchSchema = z.object({
  note: z.string().trim().min(1).max(4000).optional(),
})

const assignOwnerPayloadSchema = z.object({
  owner_id: uuidSchema.nullable(),
})

const changeStagePayloadSchema = z.object({
  stage: stageSchema,
  next_followup_at: z.string().date().nullable().optional(),
  contact: nullableTrimmedString,
})

const setSourcePayloadSchema = z.object({
  source_type: sourceTypeSchema,
  source_detail: nullableTrimmedString,
})

const setFollowupPayloadSchema = z.object({
  next_followup_at: z.string().date().nullable(),
  followup_window: followupWindowSchema.optional(),
})

const servicesPayloadSchema = z.object({
  service_ids: z.array(uuidSchema).min(1),
})

export const bulkLeadActionSchema = z.object({
  lead_ids: z.array(uuidSchema).min(1).max(500),
  action: z.enum([
    'assign_owner',
    'change_stage',
    'set_source',
    'set_followup',
    'add_services',
    'remove_services',
    'archive',
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const attachmentUploadRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(200).optional(),
})

export const bulkActionPayloadValidators = {
  assign_owner: assignOwnerPayloadSchema,
  change_stage: changeStagePayloadSchema,
  set_source: setSourcePayloadSchema,
  set_followup: setFollowupPayloadSchema,
  add_services: servicesPayloadSchema,
  remove_services: servicesPayloadSchema,
  archive: z.object({}).optional(),
}
