import { randomUUID } from 'crypto'

import {
  getProfileOrThrow,
  requireLeadEdit,
  requireLeadRead,
} from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { sanitizeFilename } from '@/lib/leads'
import { searchParamsToObject } from '@/lib/query'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { attachmentUploadRequestSchema } from '@/lib/validation/leads'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ leadId: string }>
}

const ATTACHMENT_BUCKET = 'lead_attachments'
const attachmentsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const GET = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { leadId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireLeadRead(context, leadId)
  const url = new URL(request.url)
  const query = attachmentsListQuerySchema.parse(searchParamsToObject(url.searchParams))

  const { data: attachments, error, count } = await supabase
    .from('attachments')
    .select('*', { count: 'exact' })
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .range(query.offset, query.offset + query.limit - 1)

  if (error) {
    throw new ApiError(500, 'ATTACHMENT_LIST_FAILED', 'Failed to list attachments', error)
  }

  const items = await Promise.all(
    (attachments ?? []).map(async (row: { id: string; storage_path: string }) => {
      const attachment = row

      const { data: signedData } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(attachment.storage_path, 60 * 30)

      return {
        ...row,
        download_url: signedData?.signedUrl ?? null,
      }
    }),
  )

  return ok({
    items,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: count ?? 0,
    },
  })
})

export const POST = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { leadId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const lead = await requireLeadEdit(context, leadId)
  const payload = attachmentUploadRequestSchema.parse(await request.json())

  const safeFilename = sanitizeFilename(payload.filename)
  const path = `${context.profile.org_id}/${lead.table_id}/${lead.id}/${randomUUID()}-${safeFilename}`

  const { data: signedUpload, error: signedError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUploadUrl(path)

  if (signedError || !signedUpload) {
    throw new ApiError(500, 'ATTACHMENT_SIGN_FAILED', 'Failed to create upload URL', signedError)
  }

  const { data: attachment, error: insertError } = await supabase
    .from('attachments')
    .insert({
      org_id: context.profile.org_id,
      table_id: lead.table_id,
      lead_id: lead.id,
      storage_path: path,
      filename: payload.filename,
      uploaded_by: context.user.id,
    })
    .select('*')
    .single()

  if (insertError) {
    throw new ApiError(
      500,
      'ATTACHMENT_RECORD_CREATE_FAILED',
      'Failed to create attachment record',
      insertError,
    )
  }

  return ok(
    {
      item: attachment,
      upload: {
        token: signedUpload.token,
        path,
      },
    },
    201,
  )
})
