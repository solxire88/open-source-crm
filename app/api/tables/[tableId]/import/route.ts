import {
  getProfileOrThrow,
  requireTableEdit,
} from '@/lib/auth'
import type { StageValue, SourceTypeValue } from '@/lib/backend-types'
import { parseCsv } from '@/lib/csv/parse'
import {
  normalizeImportRow,
  type ImportMappingConfig,
} from '@/lib/csv/normalize'
import { ApiError, badRequest, ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  csvImportConfigSchema,
  csvImportStorageRequestSchema,
} from '@/lib/validation/import'

interface RouteContext {
  params: Promise<{ tableId: string }>
}

const IMPORT_STORAGE_BUCKET = 'lead_attachments'

interface ImportConfig {
  mapping?: ImportMappingConfig
  default_stage?: StageValue
  default_source_type?: SourceTypeValue
  default_source_detail?: string
}

const readImportInput = async (
  request: Request,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  orgId: string,
  tableId: string,
): Promise<{ csvText: string; fileName: string; config: ImportConfig }> => {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const fileEntry = formData.get('file')

    if (!(fileEntry instanceof File)) {
      throw new ApiError(400, 'BAD_REQUEST', 'file is required in multipart form-data')
    }

    let config: ImportConfig = {}
    const configRaw = formData.get('config')
    if (typeof configRaw === 'string' && configRaw.trim().length > 0) {
      config = csvImportConfigSchema.parse(JSON.parse(configRaw))
    }

    return {
      csvText: await fileEntry.text(),
      fileName: fileEntry.name,
      config,
    }
  }

  const payload = csvImportStorageRequestSchema.parse(await request.json())
  const storagePath = payload.storage_path.trim()
  const [pathOrgId, pathTableId] = storagePath.split('/')

  if (!pathOrgId || !pathTableId) {
    badRequest('storage_path must follow org_id/table_id/... format')
  }

  if (pathOrgId !== orgId || pathTableId !== tableId) {
    badRequest('storage_path must belong to the same org and table')
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(IMPORT_STORAGE_BUCKET)
    .download(storagePath)

  if (downloadError || !blob) {
    throw new ApiError(500, 'IMPORT_STORAGE_DOWNLOAD_FAILED', 'Failed to download CSV from storage', downloadError)
  }

  return {
    csvText: await blob.text(),
    fileName: storagePath.split('/').pop() ?? 'import.csv',
    config: payload.config ?? {},
  }
}

export const POST = withErrorHandling(async (request: Request, { params }: RouteContext) => {
  const { tableId } = await params
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const table = await requireTableEdit(context, tableId)

  const {
    csvText,
    fileName,
    config,
  } = await readImportInput(request, supabase, context.profile.org_id, tableId)

  const rows = parseCsv(csvText)

  if (rows.length === 0) {
    return ok({ imported_count: 0, duplicate_candidates: [], batch_id: null })
  }

  const defaults = {
    default_stage: config.default_stage ?? table.default_stage,
    default_source_type:
      config.default_source_type ?? table.default_source_type ?? 'Unknown',
    default_source_detail:
      config.default_source_detail ?? table.default_source_detail ?? null,
  }

  const normalized = rows
    .map((row) => normalizeImportRow(row, config.mapping ?? {}, defaults))
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (normalized.length === 0) {
    return ok({
      imported_count: 0,
      duplicate_candidates: [],
      batch_id: null,
      invalid_rows: rows.length,
    })
  }

  const domains = Array.from(
    new Set(normalized.map((row) => row.domain).filter((value): value is string => Boolean(value))),
  )
  const contacts = Array.from(
    new Set(
      normalized.map((row) => row.contact).filter((value): value is string => Boolean(value)),
    ),
  )
  const websites = Array.from(
    new Set(
      normalized
        .map((row) => row.website_url)
        .filter((value): value is string => Boolean(value)),
    ),
  )

  const [domainMatches, contactMatches, websiteMatches] = await Promise.all([
    domains.length > 0
      ? supabase
          .from('leads')
          .select('id, domain, table_id')
          .eq('table_id', tableId)
          .in('domain', domains)
      : Promise.resolve({ data: [], error: null }),
    contacts.length > 0
      ? supabase
          .from('leads')
          .select('id, contact, table_id')
          .eq('table_id', tableId)
          .in('contact', contacts)
      : Promise.resolve({ data: [], error: null }),
    websites.length > 0
      ? supabase
          .from('leads')
          .select('id, website_url, table_id')
          .eq('table_id', tableId)
          .in('website_url', websites)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (domainMatches.error || contactMatches.error || websiteMatches.error) {
    throw new ApiError(
      500,
      'IMPORT_DEDUPE_CHECK_FAILED',
      'Failed to run duplicate checks',
      {
        domain: domainMatches.error,
        contact: contactMatches.error,
        website: websiteMatches.error,
      },
    )
  }

  const knownDomain = new Set(
    (domainMatches.data ?? []).map((item: { domain: string }) => String(item.domain)),
  )
  const knownContact = new Set(
    (contactMatches.data ?? []).map((item: { contact: string }) => String(item.contact)),
  )
  const knownWebsite = new Set(
    (websiteMatches.data ?? []).map((item: { website_url: string }) => String(item.website_url)),
  )

  const duplicateCandidates: Array<{
    row_index: number
    business_name: string
    reasons: string[]
  }> = []

  const insertRows: Array<Record<string, unknown>> = []
  let invalidRows = 0

  normalized.forEach((row, index) => {
    const reasons: string[] = []

    if (row.domain && knownDomain.has(row.domain)) reasons.push('domain')
    if (row.contact && knownContact.has(row.contact)) reasons.push('contact')
    if (row.website_url && knownWebsite.has(row.website_url)) reasons.push('website_url')

    if (reasons.length > 0) {
      duplicateCandidates.push({
        row_index: index + 1,
        business_name: row.business_name,
        reasons,
      })
    }

    if (row.stage === 'Contacted' && (!row.contact || !row.next_followup_at)) {
      invalidRows += 1
      return
    }

    insertRows.push({
      org_id: context.profile.org_id,
      table_id: tableId,
      business_name: row.business_name,
      stage: row.stage,
      owner_id: row.owner_id,
      next_followup_at: row.next_followup_at,
      followup_window: 'Anytime',
      contact: row.contact,
      website_url: row.website_url,
      domain: row.domain,
      notes: row.notes,
      source_type: row.source_type,
      source_detail: row.source_detail,
      do_not_contact: row.do_not_contact,
      dnc_reason: row.dnc_reason,
      lost_reason: row.lost_reason,
      created_by: context.user.id,
      updated_by: context.user.id,
    })
  })

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      org_id: context.profile.org_id,
      table_id: tableId,
      created_by: context.user.id,
      filename: fileName,
      source_default_type: defaults.default_source_type,
      source_default_detail: defaults.default_source_detail,
      row_count: rows.length,
    })
    .select('*')
    .single()

  if (batchError || !batch) {
    throw new ApiError(500, 'IMPORT_BATCH_CREATE_FAILED', 'Failed to create import batch', batchError)
  }

  if (insertRows.length === 0) {
    return ok({
      imported_count: 0,
      duplicate_candidates: duplicateCandidates,
      batch_id: (batch as { id: string }).id,
      invalid_rows: invalidRows,
    })
  }

  const { data: insertedLeads, error: insertError } = await supabase
    .from('leads')
    .insert(insertRows)
    .select('id, table_id')

  if (insertError) {
    throw new ApiError(500, 'IMPORT_INSERT_FAILED', 'Failed to import leads', insertError)
  }

  if ((insertedLeads ?? []).length > 0) {
    const auditRows = (insertedLeads ?? []).map((lead: { id: string; table_id: string }) => ({
      org_id: context.profile.org_id,
      table_id: lead.table_id,
      lead_id: lead.id,
      actor_user_id: context.user.id,
      event_type: 'imported',
      meta: {
        batch_id: (batch as { id: string }).id,
      },
    }))

    const { error: auditError } = await supabase.from('audit_events').insert(auditRows)
    if (auditError) {
      throw new ApiError(500, 'IMPORT_AUDIT_FAILED', 'Import succeeded but audit failed', auditError)
    }
  }

  return ok({
    imported_count: (insertedLeads ?? []).length,
    duplicate_candidates: duplicateCandidates,
    batch_id: (batch as { id: string }).id,
    invalid_rows: invalidRows,
  })
})
