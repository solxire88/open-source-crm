import type {
  Attachment,
  Lead,
  LeadEvent,
  Org,
  SalesTable,
  Service,
  TablePermission,
  User,
} from '@/lib/types'

const mapEventType = (value: string): LeadEvent['type'] => {
  const mapping: Record<string, LeadEvent['type']> = {
    stage_changed: 'stage_change',
    owner_changed: 'owner_change',
    followup_changed: 'follow_up_change',
    dnc_changed: 'dnc_change',
    services_changed: 'services_change',
    imported: 'import',
    created: 'import',
    archived: 'note_added',
    touch_logged: 'touch_logged',
    merged: 'merge',
    note_added: 'note_added',
  }

  return mapping[value] ?? 'note_added'
}

export const toUser = (
  profile: {
    user_id: string
    display_name: string
    role: 'admin' | 'sales'
  },
  email?: string | null,
): User => ({
  id: profile.user_id,
  name: profile.display_name,
  email: email ?? '',
  role: profile.role,
})

export const toOrg = (organization: {
  id: string
  name: string
  logo_url?: string | null
  logo_signed_url?: string | null
}): Org => ({
  id: organization.id,
  name: organization.name,
  logoUrl: organization.logo_signed_url ?? organization.logo_url ?? null,
})

export const toSalesTable = (table: {
  id: string
  name: string
  is_archived: boolean
  default_stage: Lead['stage']
  default_source_type: Lead['sourceType'] | null
  default_source_detail: string | null
}): SalesTable => ({
  id: table.id,
  name: table.name,
  isArchived: table.is_archived,
  defaults: {
    defaultStage: table.default_stage,
    defaultSourceType: table.default_source_type ?? 'Unknown',
    defaultSourceDetail: table.default_source_detail ?? undefined,
  },
})

export const toTablePermission = (row: {
  table_id: string
  user_id: string
  access_level: 'read' | 'edit'
}): TablePermission => ({
  tableId: row.table_id,
  userId: row.user_id,
  access: row.access_level,
})

export const toService = (service: {
  id: string
  table_id: string
  name: string
  is_archived: boolean
}): Service => ({
  id: service.id,
  tableId: service.table_id,
  name: service.name,
  isArchived: service.is_archived,
})

export const toLead = (
  lead: {
    id: string
    table_id: string
    business_name: string
    stage: Lead['stage']
    owner_id: string | null
    next_followup_at: string | null
    followup_window: Lead['followUpWindow']
    contact: string | null
    website_url: string | null
    notes: string | null
    source_type: Lead['sourceType']
    source_detail: string | null
    last_touched_at: string | null
    do_not_contact: boolean
    dnc_reason: string | null
    lost_reason: string | null
    is_archived: boolean
    stage_changed_at: string
    created_at: string
    lead_services?: Array<{ service_id: string }>
  },
  serviceIdsOverride?: string[],
): Lead => ({
  id: lead.id,
  tableId: lead.table_id,
  businessName: lead.business_name,
  stage: lead.stage,
  ownerId: lead.owner_id,
  nextFollowUpAt: lead.next_followup_at,
  followUpWindow: lead.followup_window,
  contact: lead.contact ?? '',
  websiteUrl: lead.website_url ?? '',
  notes: lead.notes ?? '',
  sourceType: lead.source_type,
  sourceDetail: lead.source_detail ?? '',
  interestedServices:
    serviceIdsOverride ??
    (lead.lead_services ?? []).map((entry) => entry.service_id),
  lastTouchedAt: lead.last_touched_at ?? lead.created_at,
  doNotContact: lead.do_not_contact,
  dncReason: lead.dnc_reason ?? '',
  lostReason: lead.lost_reason ?? '',
  isArchived: lead.is_archived,
  stageChangedAt: lead.stage_changed_at,
  createdAt: lead.created_at,
})

export const toLeadEvent = (event: {
  id: string
  lead_id: string
  actor_user_id: string | null
  event_type: string
  meta: Record<string, string>
  created_at: string
}): LeadEvent => ({
  id: event.id,
  leadId: event.lead_id,
  type: mapEventType(event.event_type),
  byUser: event.actor_user_id ?? 'system',
  createdAt: event.created_at,
  meta: (event.meta ?? {}) as Record<string, string>,
})

export const toAttachment = (attachment: {
  id: string
  lead_id: string
  filename: string
  download_url: string | null
  uploaded_by: string
  created_at: string
}): Attachment => ({
  id: attachment.id,
  leadId: attachment.lead_id,
  filename: attachment.filename,
  url: attachment.download_url ?? '',
  uploadedBy: attachment.uploaded_by,
  createdAt: attachment.created_at,
})

