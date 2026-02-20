import {
  getProfileOrThrow,
  requireLeadRead,
  requireTableEdit,
} from '@/lib/auth'
import { ApiError, conflict, forbidden, ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { claimLeadSchema } from '@/lib/validation/leads'

interface RouteContext {
  params: Promise<{ leadId: string }>
}

export const POST = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { leadId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const lead = await requireLeadRead(context, leadId)
  await requireTableEdit(context, lead.table_id)

  let payload: { owner_id?: string } | undefined
  try {
    payload = claimLeadSchema.parse(await request.json())
  } catch {
    payload = undefined
  }

  const requestedOwnerId = payload?.owner_id

  if (
    requestedOwnerId &&
    context.profile.role !== 'admin' &&
    requestedOwnerId !== context.user.id
  ) {
    forbidden('Sales users can only claim leads for themselves')
  }

  if (lead.owner_id && lead.owner_id !== context.user.id && context.profile.role !== 'admin') {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .eq('user_id', lead.owner_id)
      .maybeSingle()

    conflict('Lead is already claimed', {
      owner: ownerProfile ?? { user_id: lead.owner_id },
    })
  }

  const nextOwnerId =
    context.profile.role === 'admin'
      ? requestedOwnerId ?? context.user.id
      : context.user.id

  const { data: updated, error } = await supabase
    .from('leads')
    .update({
      owner_id: nextOwnerId,
      updated_by: context.user.id,
      last_touched_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'LEAD_CLAIM_FAILED', 'Failed to claim lead', error)
  }

  return ok({ item: updated })
})
