import { getProfileOrThrow, requireAdmin, requireLeadRead } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ leadId: string }>
}

export const POST = withErrorHandling(async (_request: Request, { params }: RouteContext) => {
  const { leadId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireLeadRead(context, leadId)
  requireAdmin(context)

  const { data, error } = await supabase
    .from('leads')
    .update({
      is_archived: false,
      updated_by: context.user.id,
    })
    .eq('id', leadId)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'LEAD_RESTORE_FAILED', 'Failed to restore lead', error)
  }

  return ok({ item: data })
})
