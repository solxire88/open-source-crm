import { getProfileOrThrow } from '@/lib/auth'
import { getAnalyticsSnapshot } from '@/lib/analytics'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { parseCsvParam, searchParamsToObject } from '@/lib/query'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { analyticsQuerySchema } from '@/lib/validation/analytics'

export const GET = withErrorHandling(async (request: Request) => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const url = new URL(request.url)
  const query = analyticsQuerySchema.parse(searchParamsToObject(url.searchParams))

  const requestedTableIds = parseCsvParam(query.tableIds)

  const { data: accessibleTables, error: tableError } = await supabase
    .from('lead_tables')
    .select('id')
    .eq('org_id', context.profile.org_id)

  if (tableError) {
    throw new ApiError(500, 'ANALYTICS_TABLE_SCOPE_FAILED', 'Failed to resolve accessible tables', tableError)
  }

  const accessibleSet = new Set<string>(
    (accessibleTables ?? []).map((row: { id: string }) => row.id),
  )

  let effectiveTableIds: string[] | undefined
  if (requestedTableIds.length > 0) {
    effectiveTableIds = requestedTableIds.filter((tableId) => accessibleSet.has(tableId))
  } else if (context.profile.role === 'admin') {
    effectiveTableIds = Array.from(accessibleSet)
  } else {
    effectiveTableIds = undefined
  }

  const snapshot = await getAnalyticsSnapshot(supabase, {
    range: query.range,
    tableIds: effectiveTableIds,
    ownerId: query.ownerId,
  })

  return ok({
    range: query.range,
    table_ids: effectiveTableIds ?? null,
    data: snapshot,
  })
})
