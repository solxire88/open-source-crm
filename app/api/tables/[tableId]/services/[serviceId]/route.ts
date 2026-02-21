import {
  getProfileOrThrow,
  requireAdmin,
  requireTableRead,
} from '@/lib/auth'
import { ApiError, notFound, ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { serviceUpdateSchema } from '@/lib/validation/services'

interface RouteContext {
  params: Promise<{ tableId: string; serviceId: string }>
}

export const PATCH = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { tableId, serviceId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireTableRead(context, tableId)
  requireAdmin(context)

  const payload = serviceUpdateSchema.parse(await request.json())

  const { data: existing, error: lookupError } = await supabase
    .from('table_services')
    .select('id, table_id')
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
    .update(payload)
    .eq('id', serviceId)
    .eq('table_id', tableId)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'SERVICE_UPDATE_FAILED', 'Failed to update service', error)
  }

  return ok({ item: data })
})

export const DELETE = withErrorHandling(async (_request: Request, { params }: RouteContext) => {
  const { tableId, serviceId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireTableRead(context, tableId)
  requireAdmin(context)

  const { data: existing, error: lookupError } = await supabase
    .from('table_services')
    .select('id, table_id')
    .eq('id', serviceId)
    .eq('table_id', tableId)
    .maybeSingle()

  if (lookupError) {
    throw new ApiError(500, 'SERVICE_LOOKUP_FAILED', 'Failed to lookup service', lookupError)
  }

  if (!existing) {
    notFound('Service not found')
  }

  const { error } = await supabase
    .from('table_services')
    .delete()
    .eq('id', serviceId)
    .eq('table_id', tableId)

  if (error) {
    throw new ApiError(500, 'SERVICE_DELETE_FAILED', 'Failed to delete service', error)
  }

  return ok({ success: true })
})
