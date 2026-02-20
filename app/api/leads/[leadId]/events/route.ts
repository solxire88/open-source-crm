import { getProfileOrThrow, requireLeadRead } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { searchParamsToObject } from '@/lib/query'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { paginationSchema } from '@/lib/validation/common'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ leadId: string }>
}

const leadEventsQuerySchema = z.object({
  limit: paginationSchema.shape.limit.default(100),
  offset: paginationSchema.shape.offset,
})

export const GET = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { leadId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireLeadRead(context, leadId)

  const url = new URL(request.url)
  const query = leadEventsQuerySchema.parse(searchParamsToObject(url.searchParams))

  const { data, error, count } = await supabase
    .from('audit_events')
    .select('id, lead_id, actor_user_id, event_type, meta, created_at', { count: 'exact' })
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .range(query.offset, query.offset + query.limit - 1)

  if (error) {
    throw new ApiError(500, 'LEAD_EVENT_LIST_FAILED', 'Failed to list lead events', error)
  }

  return ok({
    items: data ?? [],
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: count ?? 0,
    },
  })
})

