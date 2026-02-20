import {
  SOURCE_TYPE_VALUES,
  STAGE_VALUES,
  type SourceTypeValue,
  type StageValue,
} from '@/lib/backend-types'
import { extractDomain, normalizeWebsiteUrl } from '@/lib/leads'
import type { CsvRow } from '@/lib/csv/parse'

const toNullable = (value: string | undefined) => {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
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
  const businessName = toNullable(row[mapping.business_name ?? 'business_name'])
  if (!businessName) {
    return null
  }

  const websiteRaw = toNullable(row[mapping.website_url ?? 'website_url'])
  const websiteUrl = normalizeWebsiteUrl(websiteRaw)
  const domain = extractDomain(websiteUrl)

  const stageRaw = toNullable(row[mapping.stage ?? 'stage'])
  const stage = isStageValue(stageRaw) ? stageRaw : defaults.default_stage

  const sourceTypeRaw = toNullable(row[mapping.source_type ?? 'source_type'])
  const sourceType = isSourceTypeValue(sourceTypeRaw)
    ? sourceTypeRaw
    : defaults.default_source_type

  const doNotContactRaw = toNullable(row[mapping.do_not_contact ?? 'do_not_contact'])
  const doNotContact =
    doNotContactRaw != null && ['1', 'true', 'yes', 'y'].includes(doNotContactRaw.toLowerCase())

  const nextFollowupRaw = toNullable(row[mapping.next_followup_at ?? 'next_followup_at'])
  const nextFollowup =
    nextFollowupRaw != null && /^\d{4}-\d{2}-\d{2}$/.test(nextFollowupRaw)
      ? nextFollowupRaw
      : null

  return {
    business_name: businessName,
    stage,
    contact: toNullable(row[mapping.contact ?? 'contact']),
    website_url: websiteUrl,
    domain,
    notes: toNullable(row[mapping.notes ?? 'notes']),
    source_type: sourceType,
    source_detail: toNullable(row[mapping.source_detail ?? 'source_detail']) ?? defaults.default_source_detail ?? null,
    owner_id: toNullable(row[mapping.owner_id ?? 'owner_id']),
    next_followup_at: nextFollowup,
    do_not_contact: doNotContact,
    dnc_reason: toNullable(row[mapping.dnc_reason ?? 'dnc_reason']),
    lost_reason: toNullable(row[mapping.lost_reason ?? 'lost_reason']),
  }
}
