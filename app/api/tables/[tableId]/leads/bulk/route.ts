import {
  ensureLeadIdsBelongTable,
  ensureServiceIdsBelongTable,
  getProfileOrThrow,
  requireTableEdit,
} from '@/lib/auth'
import { ApiError, badRequest, ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  bulkActionPayloadValidators,
  bulkLeadActionSchema,
} from '@/lib/validation/leads'

interface RouteContext {
  params: Promise<{ tableId: string }>
}

export const POST = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { tableId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireTableEdit(context, tableId)

  const payload = bulkLeadActionSchema.parse(await request.json())
  const leadIds = Array.from(new Set(payload.lead_ids))

  if (leadIds.length !== payload.lead_ids.length) {
    badRequest('lead_ids must be unique')
  }

  await ensureLeadIdsBelongTable(context, tableId, leadIds)

  const now = new Date().toISOString()

  switch (payload.action) {
    case 'assign_owner': {
      const actionPayload = bulkActionPayloadValidators.assign_owner.parse(
        payload.payload ?? {},
      )

      const { error } = await supabase
        .from('leads')
        .update({
          owner_id: actionPayload.owner_id,
          updated_by: context.user.id,
        })
        .eq('table_id', tableId)
        .in('id', leadIds)

      if (error) {
        throw new ApiError(500, 'BULK_ASSIGN_OWNER_FAILED', 'Failed bulk assign owner', error)
      }
      break
    }

    case 'change_stage': {
      const actionPayload = bulkActionPayloadValidators.change_stage.parse(
        payload.payload ?? {},
      )

      if (
        actionPayload.stage === 'Contacted' &&
        (!actionPayload.next_followup_at || !actionPayload.contact)
      ) {
        badRequest('Contacted stage requires next_followup_at and contact in bulk payload')
      }

      const { error } = await supabase
        .from('leads')
        .update({
          stage: actionPayload.stage,
          next_followup_at: actionPayload.next_followup_at ?? null,
          contact: actionPayload.contact ?? null,
          updated_by: context.user.id,
        })
        .eq('table_id', tableId)
        .in('id', leadIds)

      if (error) {
        throw new ApiError(500, 'BULK_CHANGE_STAGE_FAILED', 'Failed bulk change stage', error)
      }
      break
    }

    case 'set_source': {
      const actionPayload = bulkActionPayloadValidators.set_source.parse(payload.payload ?? {})

      const { error } = await supabase
        .from('leads')
        .update({
          source_type: actionPayload.source_type,
          source_detail: actionPayload.source_detail ?? null,
          updated_by: context.user.id,
        })
        .eq('table_id', tableId)
        .in('id', leadIds)

      if (error) {
        throw new ApiError(500, 'BULK_SET_SOURCE_FAILED', 'Failed bulk set source', error)
      }
      break
    }

    case 'set_followup': {
      const actionPayload = bulkActionPayloadValidators.set_followup.parse(payload.payload ?? {})

      const { error } = await supabase
        .from('leads')
        .update({
          next_followup_at: actionPayload.next_followup_at,
          followup_window: actionPayload.followup_window,
          updated_by: context.user.id,
        })
        .eq('table_id', tableId)
        .in('id', leadIds)

      if (error) {
        throw new ApiError(500, 'BULK_SET_FOLLOWUP_FAILED', 'Failed bulk set follow-up', error)
      }
      break
    }

    case 'add_services': {
      const actionPayload = bulkActionPayloadValidators.add_services.parse(payload.payload ?? {})
      await ensureServiceIdsBelongTable(context, tableId, actionPayload.service_ids)

      const rows = leadIds.flatMap((leadId) =>
        actionPayload.service_ids.map((serviceId) => ({
          lead_id: leadId,
          service_id: serviceId,
        })),
      )

      const { error } = await supabase
        .from('lead_services')
        .upsert(rows, { onConflict: 'lead_id,service_id', ignoreDuplicates: true })

      if (error) {
        throw new ApiError(500, 'BULK_ADD_SERVICES_FAILED', 'Failed bulk add services', error)
      }
      break
    }

    case 'remove_services': {
      const actionPayload = bulkActionPayloadValidators.remove_services.parse(
        payload.payload ?? {},
      )
      await ensureServiceIdsBelongTable(context, tableId, actionPayload.service_ids)

      const { error } = await supabase
        .from('lead_services')
        .delete()
        .in('lead_id', leadIds)
        .in('service_id', actionPayload.service_ids)

      if (error) {
        throw new ApiError(
          500,
          'BULK_REMOVE_SERVICES_FAILED',
          'Failed bulk remove services',
          error,
        )
      }
      break
    }

    case 'archive': {
      bulkActionPayloadValidators.archive.parse(payload.payload ?? {})

      const { error } = await supabase
        .from('leads')
        .update({
          is_archived: true,
          updated_by: context.user.id,
        })
        .eq('table_id', tableId)
        .in('id', leadIds)

      if (error) {
        throw new ApiError(500, 'BULK_ARCHIVE_FAILED', 'Failed bulk archive', error)
      }
      break
    }

    default:
      badRequest('Unsupported bulk action')
  }

  const auditRows = leadIds.map((leadId) => ({
    org_id: context.profile.org_id,
    table_id: tableId,
    lead_id: leadId,
    actor_user_id: context.user.id,
    event_type: `bulk_${payload.action}`,
    meta: {
      action: payload.action,
      payload: payload.payload ?? {},
      occurred_at: now,
    },
  }))

  const { error: auditError } = await supabase.from('audit_events').insert(auditRows)

  if (auditError) {
    throw new ApiError(500, 'BULK_AUDIT_FAILED', 'Bulk action succeeded but audit failed', auditError)
  }

  return ok({
    success: true,
    action: payload.action,
    affected_count: leadIds.length,
  })
})
