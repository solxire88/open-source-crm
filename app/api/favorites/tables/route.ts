import { getProfileOrThrow } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { favoriteTablesPutSchema } from '@/lib/validation/favorites'

export const GET = withErrorHandling(async () => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const { data, error } = await supabase
    .from('favorite_tables')
    .select('table_id, created_at')
    .eq('user_id', context.user.id)
    .order('created_at', { ascending: true })

  if (error) {
    throw new ApiError(500, 'FAVORITE_TABLE_LIST_FAILED', 'Failed to list favorite tables', error)
  }

  return ok({
    table_ids: (data ?? []).map((row: { table_id: string }) => row.table_id),
  })
})

export const PUT = withErrorHandling(async (request: Request) => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const payload = favoriteTablesPutSchema.parse(await request.json())
  const requestedIds = Array.from(new Set(payload.table_ids))

  let allowedIds: string[] = []
  if (requestedIds.length > 0) {
    const { data: tables, error: tablesError } = await supabase
      .from('lead_tables')
      .select('id')
      .in('id', requestedIds)

    if (tablesError) {
      throw new ApiError(
        500,
        'FAVORITE_TABLE_SCOPE_CHECK_FAILED',
        'Failed to verify favorite table scope',
        tablesError,
      )
    }

    allowedIds = (tables ?? []).map((row: { id: string }) => row.id)
  }

  const { error: deleteError } = await supabase
    .from('favorite_tables')
    .delete()
    .eq('user_id', context.user.id)

  if (deleteError) {
    throw new ApiError(500, 'FAVORITE_TABLE_CLEAR_FAILED', 'Failed to clear favorite tables', deleteError)
  }

  if (allowedIds.length > 0) {
    const rows = allowedIds.map((tableId) => ({
      user_id: context.user.id,
      table_id: tableId,
    }))

    const { error: insertError } = await supabase.from('favorite_tables').insert(rows)

    if (insertError) {
      throw new ApiError(
        500,
        'FAVORITE_TABLE_SAVE_FAILED',
        'Failed to save favorite tables',
        insertError,
      )
    }
  }

  return ok({ table_ids: allowedIds })
})

