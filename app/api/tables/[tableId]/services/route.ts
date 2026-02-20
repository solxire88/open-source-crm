import {
  getProfileOrThrow,
  requireAdmin,
  requireTableRead,
} from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { searchParamsToObject } from '@/lib/query'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { serviceCreateSchema } from '@/lib/validation/services'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ tableId: string }>
}

const servicesListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const GET = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { tableId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireTableRead(context, tableId)
  const url = new URL(request.url)
  const query = servicesListQuerySchema.parse(searchParamsToObject(url.searchParams))

  const { data, error, count } = await supabase
    .from('table_services')
    .select('*', { count: 'exact' })
    .eq('table_id', tableId)
    .order('is_archived', { ascending: true })
    .order('name', { ascending: true })
    .range(query.offset, query.offset + query.limit - 1)

  if (error) {
    throw new ApiError(500, 'SERVICE_LIST_FAILED', 'Failed to list services', error)
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

export const POST = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { tableId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireTableRead(context, tableId)
  requireAdmin(context)

  const payload = serviceCreateSchema.parse(await request.json())

  const { data, error } = await supabase
    .from('table_services')
    .insert({
      org_id: context.profile.org_id,
      table_id: tableId,
      name: payload.name,
    })
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'SERVICE_CREATE_FAILED', 'Failed to create service', error)
  }

  return ok({ item: data }, 201)
})
