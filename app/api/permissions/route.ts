import { z } from 'zod'

import { getProfileOrThrow, requireAdmin } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { searchParamsToObject } from '@/lib/query'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const permissionsListQuerySchema = z.object({
  tableIds: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})

export const GET = withErrorHandling(async (request: Request) => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)
  requireAdmin(context)

  const url = new URL(request.url)
  const query = permissionsListQuerySchema.parse(searchParamsToObject(url.searchParams))

  const parsedTableIds =
    query.tableIds
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? []

  const tableIds = Array.from(new Set(parsedTableIds))

  let statement = supabase
    .from('table_permissions')
    .select('table_id, user_id, access_level, created_at, updated_at', { count: 'exact' })
    .eq('org_id', context.profile.org_id)
    .order('created_at', { ascending: false })

  if (tableIds.length > 0) {
    statement = statement.in('table_id', tableIds)
  }

  const { data, error, count } = await statement.range(
    query.offset,
    query.offset + query.limit - 1,
  )

  if (error) {
    throw new ApiError(500, 'PERMISSION_LIST_FAILED', 'Failed to list permissions', error)
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
