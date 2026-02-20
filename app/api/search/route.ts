import { getProfileOrThrow } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { searchParamsToObject } from '@/lib/query'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { searchQuerySchema } from '@/lib/validation/search'

export const GET = withErrorHandling(async (request: Request) => {
  const supabase = await createServerSupabaseClient()
  await getProfileOrThrow(supabase)

  const url = new URL(request.url)
  const query = searchQuerySchema.parse(searchParamsToObject(url.searchParams))

  const safeTerm = query.q.replace(/,/g, ' ').replace(/%/g, '')

  const { data: leads, error, count } = await supabase
    .from('leads')
    .select('id, table_id, business_name, domain, contact, notes, stage, owner_id, updated_at', {
      count: 'exact',
    })
    .eq('is_archived', false)
    .or(
      `business_name.ilike.%${safeTerm}%,domain.ilike.%${safeTerm}%,contact.ilike.%${safeTerm}%,notes.ilike.%${safeTerm}%`,
    )
    .order('updated_at', { ascending: false })
    .range(query.offset, query.offset + query.limit - 1)

  if (error) {
    throw new ApiError(500, 'SEARCH_FAILED', 'Failed to execute search', error)
  }

  const tableIds = Array.from(
    new Set((leads ?? []).map((lead: { table_id: string }) => String(lead.table_id))),
  )

  const { data: tables, error: tableError } = await supabase
    .from('lead_tables')
    .select('id, name')
    .in('id', tableIds.length > 0 ? tableIds : ['00000000-0000-0000-0000-000000000000'])

  if (tableError) {
    throw new ApiError(500, 'SEARCH_TABLE_LOOKUP_FAILED', 'Failed to lookup tables', tableError)
  }

  const tableNameById = new Map(
    (tables ?? []).map((table: { id: string; name: string }) => [table.id, table.name]),
  )

  const grouped = new Map<string, Array<Record<string, unknown>>>()

  ;(leads ?? []).forEach((lead: { table_id: string } & Record<string, unknown>) => {
    const tableId = String(lead.table_id)
    const bucket = grouped.get(tableId) ?? []
    bucket.push(lead)
    grouped.set(tableId, bucket)
  })

  const tablesResult = Array.from(grouped.entries()).map(([tableId, items]) => ({
    table_id: tableId,
    table_name: tableNameById.get(tableId) ?? 'Unknown table',
    items,
  }))

  return ok({
    q: query.q,
    tables: tablesResult,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: count ?? 0,
    },
  })
})
