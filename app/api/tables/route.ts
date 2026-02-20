import { z } from 'zod'

import { getProfileOrThrow, requireAdmin } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { searchParamsToObject } from '@/lib/query'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { booleanFromFlag } from '@/lib/validation/common'
import { tableCreateSchema } from '@/lib/validation/tables'

const tableListQuerySchema = z.object({
  includeArchived: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const GET = withErrorHandling(async (request: Request) => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const url = new URL(request.url)
  const query = tableListQuerySchema.parse(searchParamsToObject(url.searchParams))
  const includeArchived = booleanFromFlag(query.includeArchived, false)

  let statement = supabase
    .from('lead_tables')
    .select('*', { count: 'exact' })
    .eq('org_id', context.profile.org_id)
    .order('name', { ascending: true })

  if (!includeArchived) {
    statement = statement.eq('is_archived', false)
  }

  statement = statement.range(query.offset, query.offset + query.limit - 1)

  const { data, error, count } = await statement

  if (error) {
    throw new ApiError(500, 'TABLE_LIST_FAILED', 'Failed to list tables', error)
  }

  const rows = (data ?? []) as Array<Record<string, unknown> & { id: string }>

  let accessByTableId = new Map<string, 'read' | 'edit'>()
  if (context.profile.role === 'admin') {
    accessByTableId = new Map(rows.map((row) => [row.id, 'edit']))
  } else {
    const tableIds = rows.map((row) => row.id)
    if (tableIds.length > 0) {
      const { data: permissions, error: permissionsError } = await supabase
        .from('table_permissions')
        .select('table_id, access_level')
        .eq('user_id', context.user.id)
        .in('table_id', tableIds)

      if (permissionsError) {
        throw new ApiError(
          500,
          'TABLE_PERMISSION_LIST_FAILED',
          'Failed to resolve table access',
          permissionsError,
        )
      }

      accessByTableId = new Map(
        (permissions ?? []).map((row: { table_id: string; access_level: 'read' | 'edit' }) => [
          row.table_id,
          row.access_level,
        ]),
      )
    }
  }

  const items = rows.map((row) => ({
    ...row,
    access_level: accessByTableId.get(row.id) ?? 'read',
  }))

  return ok({
    items,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: count ?? 0,
    },
  })
})

export const POST = withErrorHandling(async (request: Request) => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)
  requireAdmin(context)

  const payload = tableCreateSchema.parse(await request.json())
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('lead_tables')
    .insert({
      org_id: context.profile.org_id,
      name: payload.name,
      default_stage: payload.default_stage ?? 'New',
      default_source_type: payload.default_source_type ?? null,
      default_source_detail: payload.default_source_detail ?? null,
      created_by: context.user.id,
    })
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'TABLE_CREATE_FAILED', 'Failed to create table', error)
  }

  return ok({ item: data }, 201)
})
