import { getProfileOrThrow, requireAdmin } from '@/lib/auth'
import { ApiError, notFound, ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { adminPatchUserSchema } from '@/lib/validation/admin'

interface RouteContext {
  params: Promise<{ userId: string }>
}

export const PATCH = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { userId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  requireAdmin(context)

  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('org_id', context.profile.org_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (lookupError) {
    throw new ApiError(500, 'ADMIN_USER_LOOKUP_FAILED', 'Failed to lookup user', lookupError)
  }

  if (!existing) {
    notFound('User not found')
  }

  const payload = adminPatchUserSchema.parse(await request.json())

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('org_id', context.profile.org_id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'ADMIN_USER_UPDATE_FAILED', 'Failed to update user', error)
  }

  return ok({ item: data })
})

export const DELETE = withErrorHandling(async (_request: Request, { params }: RouteContext) => {
  const { userId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  requireAdmin(context)

  const { data, error } = await supabase
    .from('profiles')
    .update({ is_disabled: true })
    .eq('org_id', context.profile.org_id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error || !data) {
    throw new ApiError(500, 'ADMIN_USER_DISABLE_FAILED', 'Failed to disable user', error)
  }

  return ok({ item: data })
})
