import { getProfileOrThrow, requireLeadEdit } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ leadId: string }>
}

export const POST = withErrorHandling(async (_request: Request, { params }: RouteContext) => {
  const { leadId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireLeadEdit(context, leadId)

  const { data, error } = await supabase
    .from('leads')
    .update({
      is_archived: true,
      updated_by: context.user.id,
    })
    .eq('id', leadId)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'LEAD_ARCHIVE_FAILED', 'Failed to archive lead', error)
  }

  return ok({ item: data })
})
