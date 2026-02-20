import { getProfileOrThrow, requireAdmin, requireTableRead } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { tableUpdateSchema } from '@/lib/validation/tables'

interface RouteContext {
  params: Promise<{ tableId: string }>
}

export const GET = withErrorHandling(async (_request: Request, { params }: RouteContext) => {
  const { tableId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const table = await requireTableRead(context, tableId)

  let accessLevel: 'read' | 'edit' = 'read'
  if (context.profile.role === 'admin') {
    accessLevel = 'edit'
  } else {
    const { data: permission, error: permissionError } = await supabase
      .from('table_permissions')
      .select('access_level')
      .eq('table_id', tableId)
      .eq('user_id', context.user.id)
      .maybeSingle()

    if (permissionError) {
      throw new ApiError(
        500,
        'TABLE_PERMISSION_LOOKUP_FAILED',
        'Failed to lookup table access',
        permissionError,
      )
    }

    accessLevel = (permission?.access_level ?? 'read') as 'read' | 'edit'
  }

  return ok({
    item: {
      ...table,
      access_level: accessLevel,
    },
  })
})

export const PATCH = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { tableId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)
  await requireTableRead(context, tableId)
  requireAdmin(context)

  const payload = tableUpdateSchema.parse(await request.json())

  const { data, error } = await supabase
    .from('lead_tables')
    .update(payload)
    .eq('id', tableId)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'TABLE_UPDATE_FAILED', 'Failed to update table', error)
  }

  return ok({ item: data })
})
