import {
  getProfileOrThrow,
  requireAdmin,
  requireTableRead,
} from '@/lib/auth'
import { ApiError, notFound, ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ tableId: string; serviceId: string }>
}

export const POST = withErrorHandling(async (_request: Request, { params }: RouteContext) => {
  const { tableId, serviceId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireTableRead(context, tableId)
  requireAdmin(context)

  const { data: existing, error: lookupError } = await supabase
    .from('table_services')
    .select('id')
    .eq('id', serviceId)
    .eq('table_id', tableId)
    .maybeSingle()

  if (lookupError) {
    throw new ApiError(500, 'SERVICE_LOOKUP_FAILED', 'Failed to lookup service', lookupError)
  }

  if (!existing) {
    notFound('Service not found')
  }

  const { data, error } = await supabase
    .from('table_services')
    .update({ is_archived: true })
    .eq('id', serviceId)
    .eq('table_id', tableId)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'SERVICE_ARCHIVE_FAILED', 'Failed to archive service', error)
  }

  return ok({ item: data })
})
