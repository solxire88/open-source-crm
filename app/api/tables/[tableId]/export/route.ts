import { getProfileOrThrow, requireAdmin, requireTableRead } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { searchParamsToObject } from '@/lib/query'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { exportQuerySchema } from '@/lib/validation/export'

interface RouteContext {
  params: Promise<{ tableId: string }>
}

const csvEscape = (value: unknown) => {
  if (value == null) return ''
  const raw = String(value)
  if (!/[",\n]/.test(raw)) return raw
  return `"${raw.replace(/"/g, '""')}"`
}

const toCsv = (columns: string[], rows: Array<Record<string, unknown>>) => {
  const header = columns.join(',')
  const body = rows
    .map((row) => columns.map((column) => csvEscape(row[column])).join(','))
    .join('\n')
  return `${header}\n${body}`
}

export const GET = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { tableId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  await requireTableRead(context, tableId)
  requireAdmin(context)

  const url = new URL(request.url)
  const query = exportQuerySchema.parse(searchParamsToObject(url.searchParams))

  let statement = supabase
    .from('leads')
    .select('*')
    .eq('table_id', tableId)
    .order('created_at', { ascending: false })

  if (query.includeArchived !== '1') {
    statement = statement.eq('is_archived', false)
  }

  if (query.includeDnc !== '1') {
    statement = statement.eq('do_not_contact', false)
  }

  const { data: leads, error: leadsError } = await statement

  if (leadsError) {
    throw new ApiError(500, 'EXPORT_LEAD_FETCH_FAILED', 'Failed to fetch leads for export', leadsError)
  }

  const leadIds = (leads ?? []).map((lead: { id: string }) => String(lead.id))
  const { data: leadServices, error: servicesError } = await supabase
    .from('lead_services')
    .select('lead_id, table_services(name)')
    .in('lead_id', leadIds.length > 0 ? leadIds : ['00000000-0000-0000-0000-000000000000'])

  if (servicesError) {
    throw new ApiError(
      500,
      'EXPORT_SERVICES_FETCH_FAILED',
      'Failed to fetch lead services for export',
      servicesError,
    )
  }

  const servicesByLead = new Map<string, string[]>()
  ;(leadServices ?? []).forEach((entry: { lead_id: string; table_services: { name: string } | null }) => {
    const row = entry
    const bucket = servicesByLead.get(row.lead_id) ?? []
    if (row.table_services?.name) {
      bucket.push(row.table_services.name)
    }
    servicesByLead.set(row.lead_id, bucket)
  })

  const rows = (leads ?? []).map((lead: Record<string, unknown> & { id: string }) => {
    const row = lead
    return {
      ...row,
      services: (servicesByLead.get(row.id) ?? []).join(', '),
    }
  })

  const columnsByTemplate: Record<string, string[]> = {
    full: [
      'id',
      'business_name',
      'stage',
      'owner_id',
      'contact',
      'website_url',
      'domain',
      'next_followup_at',
      'followup_window',
      'source_type',
      'source_detail',
      'do_not_contact',
      'dnc_reason',
      'lost_reason',
      'services',
      'notes',
      'last_touched_at',
      'is_archived',
      'created_at',
      'updated_at',
    ],
    calling: [
      'business_name',
      'contact',
      'stage',
      'next_followup_at',
      'followup_window',
      'owner_id',
      'notes',
      'services',
    ],
    source_report: [
      'business_name',
      'source_type',
      'source_detail',
      'stage',
      'owner_id',
      'services',
      'created_at',
    ],
    services_report: [
      'business_name',
      'services',
      'stage',
      'owner_id',
      'source_type',
      'created_at',
      'updated_at',
    ],
  }

  const columns = columnsByTemplate[query.template]
  const csv = toCsv(columns, rows)

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="table-${tableId}-${query.template}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
})
