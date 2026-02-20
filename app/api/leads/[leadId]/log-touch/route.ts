import { getProfileOrThrow, requireLeadEdit } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { appendTimestampedNote } from '@/lib/leads'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logTouchSchema } from '@/lib/validation/leads'

interface RouteContext {
  params: Promise<{ leadId: string }>
}

export const POST = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { leadId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const lead = await requireLeadEdit(context, leadId)
  const payload = logTouchSchema.parse(await request.json())

  const now = new Date().toISOString()
  const notes = payload.note
    ? appendTimestampedNote(lead.notes, payload.note, context.profile.display_name)
    : lead.notes

  const { data: updated, error: updateError } = await supabase
    .from('leads')
    .update({
      last_touched_at: now,
      notes,
      updated_by: context.user.id,
    })
    .eq('id', leadId)
    .select('*')
    .single()

  if (updateError || !updated) {
    throw new ApiError(500, 'LEAD_TOUCH_FAILED', 'Failed to log touch', updateError)
  }

  const { error: auditError } = await supabase.from('audit_events').insert({
    org_id: lead.org_id,
    table_id: lead.table_id,
    lead_id: lead.id,
    actor_user_id: context.user.id,
    event_type: 'touch_logged',
    meta: {
      note: payload.note ?? null,
      touched_at: now,
    },
  })

  if (auditError) {
    throw new ApiError(500, 'LEAD_TOUCH_AUDIT_FAILED', 'Failed to persist touch audit event', auditError)
  }

  return ok({ item: updated })
})
