import { getProfileOrThrow, requireAdmin } from '@/lib/auth'
import { ApiError, badRequest, notFound, ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { adminReassignLeadsSchema } from '@/lib/validation/admin'

interface RouteContext {
  params: Promise<{ userId: string }>
}

export const POST = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { userId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  requireAdmin(context)

  const { data: fromProfile, error: fromProfileError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('org_id', context.profile.org_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (fromProfileError) {
    throw new ApiError(
      500,
      'ADMIN_REASSIGN_SOURCE_LOOKUP_FAILED',
      'Failed to lookup source user',
      fromProfileError,
    )
  }

  if (!fromProfile) {
    notFound('Source user not found')
  }

  const payload = adminReassignLeadsSchema.parse(await request.json())

  if (payload.to_user_id) {
    const { data: toProfile, error: toProfileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('org_id', context.profile.org_id)
      .eq('user_id', payload.to_user_id)
      .maybeSingle()

    if (toProfileError) {
      throw new ApiError(
        500,
        'ADMIN_REASSIGN_TARGET_LOOKUP_FAILED',
        'Failed to lookup target user',
        toProfileError,
      )
    }

    if (!toProfile) {
      badRequest('Target user does not belong to this organization')
    }
  }

  const { data, error } = await supabase
    .from('leads')
    .update({
      owner_id: payload.to_user_id,
      updated_by: context.user.id,
    })
    .eq('org_id', context.profile.org_id)
    .eq('owner_id', userId)
    .select('id')

  if (error) {
    throw new ApiError(500, 'ADMIN_REASSIGN_FAILED', 'Failed to reassign leads', error)
  }

  return ok({
    reassigned_count: (data ?? []).length,
    to_user_id: payload.to_user_id,
  })
})
