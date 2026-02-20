import {
  SOURCE_TYPE_VALUES,
  STAGE_VALUES,
  type SourceTypeValue,
  type StageValue,
} from '@/lib/backend-types'
import { extractDomain, normalizeWebsiteUrl } from '@/lib/leads'
import type { CsvRow } from '@/lib/csv/parse'

const canonicalizeHeader = (value: string) =>
  value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const toNullable = (value: string | undefined) => {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

const isFuzzyCanonicalMatch = (candidate: string, expected: string) => {
  if (candidate === expected) return true
  if (candidate.startsWith(`${expected}_`)) return true
  if (candidate.endsWith(`_${expected}`)) return true
  if (candidate.includes(`_${expected}_`)) return true
  return false
}

const findRowValue = (row: CsvRow, key: string | undefined) => {
  if (!key) return undefined

  if (row[key] !== undefined) {
    return row[key]
  }

  const expected = canonicalizeHeader(key)
  const canonicalEntries = Object.entries(row).map(([header, value]) => ({
    canonical: canonicalizeHeader(header),
    value,
  }))

  for (const entry of canonicalEntries) {
    if (entry.canonical === expected) {
      return entry.value
    }
  }

  for (const entry of canonicalEntries) {
    if (isFuzzyCanonicalMatch(entry.canonical, expected)) {
      return entry.value
    }
  }

  for (const entry of canonicalEntries) {
    if (expected.length >= 5 && entry.canonical.includes(expected)) {
      return entry.value
    }
  }

  for (const entry of canonicalEntries) {
    if (expected.length >= 5 && expected.includes(entry.canonical)) {
      return entry.value
    }
  }

  return undefined
}

const pickRowValue = (
  row: CsvRow,
  preferredKey: string | undefined,
  fallbackKey: string,
  aliases: string[] = [],
) => {
  const candidates = [preferredKey, fallbackKey, ...aliases]
  for (const key of candidates) {
    const value = findRowValue(row, key)
    if (value !== undefined) {
      return value
    }
  }

  return undefined
}

const isStageValue = (value: string | null): value is StageValue => {
  return value != null && STAGE_VALUES.includes(value as StageValue)
}

const isSourceTypeValue = (value: string | null): value is SourceTypeValue => {
  return value != null && SOURCE_TYPE_VALUES.includes(value as SourceTypeValue)
}

export interface ImportMappingConfig {
  business_name?: string
  stage?: string
  contact?: string
  website_url?: string
  notes?: string
  source_type?: string
  source_detail?: string
  owner_id?: string
  next_followup_at?: string
  do_not_contact?: string
  dnc_reason?: string
  lost_reason?: string
}

export interface ImportDefaults {
  default_stage: StageValue
  default_source_type: SourceTypeValue
  default_source_detail?: string | null
}

export interface NormalizedImportLead {
  business_name: string
  stage: StageValue
  contact: string | null
  website_url: string | null
  domain: string | null
  notes: string | null
  source_type: SourceTypeValue
  source_detail: string | null
  owner_id: string | null
  next_followup_at: string | null
  do_not_contact: boolean
  dnc_reason: string | null
  lost_reason: string | null
}

export const normalizeImportRow = (
  row: CsvRow,
  mapping: ImportMappingConfig,
  defaults: ImportDefaults,
): NormalizedImportLead | null => {
  const businessName = toNullable(
    pickRowValue(row, mapping.business_name, 'business_name', [
      'business name',
      'company_name',
      'company',
      'name',
    ]),
  )
  if (!businessName) {
    return null
  }

  const websiteRaw = toNullable(
    pickRowValue(row, mapping.website_url, 'website_url', [
      'website',
      'url',
      'site',
      'web',
      'domain',
    ]),
  )
  const websiteUrl = normalizeWebsiteUrl(websiteRaw)
  const domain = extractDomain(websiteUrl)

  const stageRaw = toNullable(
    pickRowValue(row, mapping.stage, 'stage', ['status', 'lead_stage']),
  )
  const stage = isStageValue(stageRaw) ? stageRaw : defaults.default_stage

  const sourceTypeRaw = toNullable(
    pickRowValue(row, mapping.source_type, 'source_type', ['source', 'lead_source']),
  )
  const sourceType = isSourceTypeValue(sourceTypeRaw)
    ? sourceTypeRaw
    : defaults.default_source_type

  const doNotContactRaw = toNullable(
    pickRowValue(row, mapping.do_not_contact, 'do_not_contact', [
      'dnc',
      'do not contact',
    ]),
  )
  const doNotContact =
    doNotContactRaw != null && ['1', 'true', 'yes', 'y'].includes(doNotContactRaw.toLowerCase())

  const nextFollowupRaw = toNullable(
    pickRowValue(row, mapping.next_followup_at, 'next_followup_at', [
      'next_follow_up_at',
      'next followup',
      'next follow-up',
      'followup_date',
      'follow_up_date',
    ]),
  )
  const nextFollowup =
    nextFollowupRaw != null && /^\d{4}-\d{2}-\d{2}$/.test(nextFollowupRaw)
      ? nextFollowupRaw
      : null

  const contact = toNullable(
    pickRowValue(row, mapping.contact, 'contact', [
      'email',
      'email_address',
      'work_email',
      'work_email_address',
      'phone',
      'phone_number',
      'phone_no',
      'phone_num',
      'mobile',
      'mobile_number',
      'whatsapp',
      'instagram',
      'ig',
      'contact_info',
      'contact_details',
    ]),
  )

  return {
    business_name: businessName,
    stage,
    contact,
    website_url: websiteUrl,
    domain,
    notes: toNullable(
      pickRowValue(row, mapping.notes, 'notes', ['note', 'description']),
    ),
    source_type: sourceType,
    source_detail:
      toNullable(
        pickRowValue(row, mapping.source_detail, 'source_detail', ['source detail']),
      ) ??
      defaults.default_source_detail ??
      null,
    owner_id: toNullable(
      pickRowValue(row, mapping.owner_id, 'owner_id', ['owner', 'owner id', 'assignee']),
    ),
    next_followup_at: nextFollowup,
    do_not_contact: doNotContact,
    dnc_reason: toNullable(
      pickRowValue(row, mapping.dnc_reason, 'dnc_reason', ['dnc reason']),
    ),
    lost_reason: toNullable(
      pickRowValue(row, mapping.lost_reason, 'lost_reason', ['loss_reason', 'lost reason']),
    ),
  }
}
