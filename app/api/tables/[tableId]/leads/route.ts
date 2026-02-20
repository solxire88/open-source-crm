import {
  ensureServiceIdsBelongTable,
  getProfileOrThrow,
  requireTableEdit,
  requireTableRead,
} from '@/lib/auth'
import { ApiError, badRequest, ok, withErrorHandling } from '@/lib/http'
import { extractDomain, normalizeWebsiteUrl } from '@/lib/leads'
import { searchParamsToObject } from '@/lib/query'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { leadsListQuerySchema, leadCreateSchema } from '@/lib/validation/leads'

interface RouteContext {
  params: Promise<{ tableId: string }>
}

const todayDateString = () => new Date().toISOString().slice(0, 10)

export const GET = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { tableId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireTableRead(context, tableId)

  const url = new URL(request.url)
  const query = leadsListQuerySchema.parse(searchParamsToObject(url.searchParams))

  const includeArchived = query.includeArchived === '1'
  const includeDnc = query.includeDnc === '1'

  let statement = supabase
    .from('leads')
    .select('*, lead_services(service_id)', { count: 'exact' })
    .eq('table_id', tableId)
    .order('updated_at', { ascending: false })

  if (!includeArchived || query.view === 'new' || query.view === 'my' || query.view === 'due') {
    statement = statement.eq('is_archived', false)
  }

  if (!includeDnc && query.view !== 'new' && query.view !== 'due') {
    statement = statement.eq('do_not_contact', false)
  }

  if (query.stage) {
    statement = statement.eq('stage', query.stage)
  }

  if (query.ownerId) {
    statement = statement.eq('owner_id', query.ownerId)
  }

  if (query.q) {
    const safeQuery = query.q.replace(/,/g, ' ').replace(/%/g, '')
    statement = statement.or(
      `business_name.ilike.%${safeQuery}%,domain.ilike.%${safeQuery}%,contact.ilike.%${safeQuery}%,notes.ilike.%${safeQuery}%`,
    )
  }

  if (query.view === 'new') {
    statement = statement
      .eq('stage', 'New')
      .eq('do_not_contact', false)
      .eq('is_archived', false)
  }

  if (query.view === 'my') {
    statement = statement.eq('owner_id', context.user.id).eq('is_archived', false)
  }

  if (query.view === 'due') {
    statement = statement
      .lte('next_followup_at', todayDateString())
      .not('stage', 'in', '("Won","Lost")')
      .eq('do_not_contact', false)
      .eq('is_archived', false)
  }

  statement = statement.range(query.offset, query.offset + query.limit - 1)

  const { data, count, error } = await statement

  if (error) {
    throw new ApiError(500, 'LEAD_LIST_FAILED', 'Failed to list leads', error)
  }

  return ok({
    items: data ?? [],
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: count ?? 0,
    },
  })
})

export const POST = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { tableId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const table = await requireTableEdit(context, tableId)
  const payload = leadCreateSchema.parse(await request.json())

  const stage = payload.stage ?? table.default_stage
  const sourceType = payload.source_type ?? table.default_source_type ?? 'Unknown'
  const followupWindow = payload.followup_window ?? 'Anytime'
  const websiteUrl = normalizeWebsiteUrl(payload.website_url)
  const domain = extractDomain(websiteUrl)

  if (stage === 'Contacted' && (!payload.next_followup_at || !payload.contact)) {
    badRequest('Contacted stage requires next_followup_at and contact')
  }

  if (payload.service_ids?.length) {
    await ensureServiceIdsBelongTable(context, tableId, payload.service_ids)
  }

  const insertPayload = {
    org_id: context.profile.org_id,
    table_id: tableId,
    business_name: payload.business_name,
    stage,
    owner_id: payload.owner_id ?? null,
    next_followup_at: payload.next_followup_at ?? null,
    followup_window: followupWindow,
    contact: payload.contact ?? null,
    website_url: websiteUrl,
    domain,
    notes: payload.notes ?? null,
    source_type: sourceType,
    source_detail:
      payload.source_detail ?? table.default_source_detail ?? null,
    do_not_contact: payload.do_not_contact ?? false,
    dnc_reason: payload.dnc_reason ?? null,
    lost_reason: payload.lost_reason ?? null,
    is_archived: payload.is_archived ?? false,
    created_by: context.user.id,
    updated_by: context.user.id,
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .insert(insertPayload)
    .select('*')
    .single()

  if (leadError || !lead) {
    throw new ApiError(500, 'LEAD_CREATE_FAILED', 'Failed to create lead', leadError)
  }

  if (payload.service_ids && payload.service_ids.length > 0) {
    const rows = payload.service_ids.map((serviceId) => ({
      lead_id: (lead as { id: string }).id,
      service_id: serviceId,
    }))

    const { error: servicesError } = await supabase.from('lead_services').insert(rows)

    if (servicesError) {
      throw new ApiError(
        500,
        'LEAD_SERVICE_LINK_FAILED',
        'Lead created but failed to link services',
        servicesError,
      )
    }
  }

  await supabase.from('audit_events').insert({
    org_id: context.profile.org_id,
    table_id: tableId,
    lead_id: (lead as { id: string }).id,
    actor_user_id: context.user.id,
    event_type: 'created',
    meta: {
      stage,
      source_type: sourceType,
    },
  })

  return ok({ item: lead }, 201)
})
