import { getProfileOrThrow, requireAdmin, requireTableRead } from '@/lib/auth'
import { ApiError, badRequest, ok, withErrorHandling } from '@/lib/http'
import { searchParamsToObject } from '@/lib/query'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { tablePermissionPutSchema } from '@/lib/validation/tables'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ tableId: string }>
}

const permissionsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const GET = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { tableId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireTableRead(context, tableId)
  requireAdmin(context)
  const url = new URL(request.url)
  const query = permissionsListQuerySchema.parse(searchParamsToObject(url.searchParams))

  const { data: permissions, error: permissionsError, count } = await supabase
    .from('table_permissions')
    .select('id, user_id, access_level, created_at, updated_at', { count: 'exact' })
    .eq('table_id', tableId)
    .order('created_at', { ascending: false })
    .range(query.offset, query.offset + query.limit - 1)

  if (permissionsError) {
    throw new ApiError(500, 'TABLE_PERMISSION_LIST_FAILED', 'Failed to list permissions', permissionsError)
  }

  const userIds = (permissions ?? []).map((entry: { user_id: string }) => String(entry.user_id))
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, display_name, role, is_disabled')
    .eq('org_id', context.profile.org_id)
    .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])

  if (profilesError) {
    throw new ApiError(500, 'PROFILE_LOOKUP_FAILED', 'Failed to lookup profiles', profilesError)
  }

  const profileByUserId = new Map(
    (profiles ?? []).map((profile: { user_id: string }) => [
      profile.user_id,
      profile,
    ]),
  )

  const items = (permissions ?? []).map((permission: {
    id: string
    user_id: string
    access_level: 'read' | 'edit'
    created_at: string
    updated_at: string
  }) => {
    const row = permission

    return {
      ...row,
      profile: profileByUserId.get(row.user_id) ?? null,
    }
  })

  return ok({
    items,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: count ?? 0,
    },
  })
})

export const PUT = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { tableId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireTableRead(context, tableId)
  requireAdmin(context)

  const payload = tablePermissionPutSchema.parse(await request.json())

  const deduped = new Map<string, 'read' | 'edit'>()
  payload.forEach((entry) => {
    deduped.set(entry.user_id, entry.access_level)
  })

  const userIds = Array.from(deduped.keys())

  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('org_id', context.profile.org_id)
      .in('user_id', userIds)

    if (profileError) {
      throw new ApiError(500, 'PROFILE_LOOKUP_FAILED', 'Failed to lookup profiles', profileError)
    }

    const validIds = new Set(
      (profiles ?? []).map((profile: { user_id: string }) => String(profile.user_id)),
    )

    const invalid = userIds.filter((userId) => !validIds.has(userId))
    if (invalid.length > 0) {
      badRequest('One or more users do not belong to this organization', { invalid })
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from('table_permissions')
    .select('user_id')
    .eq('table_id', tableId)

  if (existingError) {
    throw new ApiError(
      500,
      'TABLE_PERMISSION_LOOKUP_FAILED',
      'Failed to lookup current permissions',
      existingError,
    )
  }

  const existingIds = (existing ?? []).map((row: { user_id: string }) => String(row.user_id))
  const toDelete = existingIds.filter((userId: string) => !deduped.has(userId))

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('table_permissions')
      .delete()
      .eq('table_id', tableId)
      .in('user_id', toDelete)

    if (deleteError) {
      throw new ApiError(
        500,
        'TABLE_PERMISSION_DELETE_FAILED',
        'Failed to delete stale permissions',
        deleteError,
      )
    }
  }

  const upsertRows = userIds.map((userId) => ({
    org_id: context.profile.org_id,
    table_id: tableId,
    user_id: userId,
    access_level: deduped.get(userId),
  }))

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase
      .from('table_permissions')
      .upsert(upsertRows, { onConflict: 'table_id,user_id' })

    if (upsertError) {
      throw new ApiError(500, 'TABLE_PERMISSION_UPSERT_FAILED', 'Failed to save permissions', upsertError)
    }
  }

  const { data: updated, error: updatedError } = await supabase
    .from('table_permissions')
    .select('id, user_id, access_level, created_at, updated_at')
    .eq('table_id', tableId)

  if (updatedError) {
    throw new ApiError(500, 'TABLE_PERMISSION_LIST_FAILED', 'Failed to fetch updated permissions', updatedError)
  }

  return ok({ items: updated ?? [] })
})
