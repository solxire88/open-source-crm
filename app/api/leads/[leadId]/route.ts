import {
  ensureServiceIdsBelongTable,
  getProfileOrThrow,
  requireLeadEdit,
  requireLeadRead,
} from '@/lib/auth'
import { ApiError, badRequest, ok, withErrorHandling } from '@/lib/http'
import { extractDomain, normalizeWebsiteUrl } from '@/lib/leads'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { leadPatchSchema } from '@/lib/validation/leads'

interface RouteContext {
  params: Promise<{ leadId: string }>
}

export const GET = withErrorHandling(async (_request: Request, { params }: RouteContext) => {
  const { leadId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const lead = await requireLeadRead(context, leadId)

  const { data: services, error: servicesError } = await supabase
    .from('lead_services')
    .select('service_id, table_services(id, name, is_archived)')
    .eq('lead_id', leadId)

  if (servicesError) {
    throw new ApiError(500, 'LEAD_SERVICE_LIST_FAILED', 'Failed to list lead services', servicesError)
  }

  return ok({ item: lead, services: services ?? [] })
})

export const PATCH = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { leadId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const lead = await requireLeadEdit(context, leadId)
  const payload = leadPatchSchema.parse(await request.json())

  if (payload.service_ids) {
    await ensureServiceIdsBelongTable(context, lead.table_id, payload.service_ids)
  }

  const nextStage = payload.stage ?? lead.stage
  const nextContact = payload.contact !== undefined ? payload.contact : lead.contact
  const nextFollowup =
    payload.next_followup_at !== undefined
      ? payload.next_followup_at
      : lead.next_followup_at

  if (nextStage === 'Contacted' && (!nextContact || !nextFollowup)) {
    badRequest('Contacted stage requires next_followup_at and contact')
  }

  const updatePayload: Record<string, unknown> = {
    updated_by: context.user.id,
  }

  const scalarFields: Array<keyof Omit<typeof payload, 'service_ids'>> = [
    'business_name',
    'stage',
    'owner_id',
    'next_followup_at',
    'followup_window',
    'contact',
    'notes',
    'source_type',
    'source_detail',
    'do_not_contact',
    'dnc_reason',
    'lost_reason',
    'is_archived',
  ]

  scalarFields.forEach((field) => {
    const value = payload[field]
    if (value !== undefined) {
      updatePayload[field] = value
    }
  })

  if (payload.website_url !== undefined) {
    const websiteUrl = normalizeWebsiteUrl(payload.website_url)
    updatePayload.website_url = websiteUrl
    updatePayload.domain = extractDomain(websiteUrl)
  }

  const { data: updatedLead, error: updateError } = await supabase
    .from('leads')
    .update(updatePayload)
    .eq('id', leadId)
    .select('*')
    .single()

  if (updateError || !updatedLead) {
    throw new ApiError(500, 'LEAD_UPDATE_FAILED', 'Failed to update lead', updateError)
  }

  if (payload.service_ids) {
    const { error: deleteError } = await supabase
      .from('lead_services')
      .delete()
      .eq('lead_id', leadId)

    if (deleteError) {
      throw new ApiError(500, 'LEAD_SERVICE_CLEAR_FAILED', 'Failed to clear lead services', deleteError)
    }

    if (payload.service_ids.length > 0) {
      const rows = payload.service_ids.map((serviceId) => ({
        lead_id: leadId,
        service_id: serviceId,
      }))

      const { error: insertError } = await supabase.from('lead_services').insert(rows)

      if (insertError) {
        throw new ApiError(500, 'LEAD_SERVICE_SET_FAILED', 'Failed to set lead services', insertError)
      }
    }
  }

  const { data: hydratedLead, error: hydratedError } = await supabase
    .from('leads')
    .select('*, lead_services(service_id)')
    .eq('id', leadId)
    .single()

  if (hydratedError || !hydratedLead) {
    throw new ApiError(
      500,
      'LEAD_RELOAD_FAILED',
      'Lead updated but failed to reload latest lead state',
      hydratedError,
    )
  }

  return ok({ item: hydratedLead })
})
