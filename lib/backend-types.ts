export const STAGE_VALUES = [
  'New',
  'Contacted',
  'Replied',
  'Meeting',
  'Proposal',
  'Won',
  'Lost',
] as const

export const ACCESS_LEVEL_VALUES = ['read', 'edit'] as const

export const ROLE_VALUES = ['admin', 'sales'] as const

export const FOLLOWUP_WINDOW_VALUES = ['Morning', 'Afternoon', 'Anytime'] as const

export const THEME_VALUES = ['light', 'dark', 'system'] as const

export const SOURCE_TYPE_VALUES = [
  'Instagram',
  'Meta Ads',
  'Scraping',
  'Referral',
  'Website',
  'Other',
  'Unknown',
] as const

export type StageValue = (typeof STAGE_VALUES)[number]
export type AccessLevelValue = (typeof ACCESS_LEVEL_VALUES)[number]
export type RoleValue = (typeof ROLE_VALUES)[number]
export type FollowupWindowValue = (typeof FOLLOWUP_WINDOW_VALUES)[number]
export type ThemeValue = (typeof THEME_VALUES)[number]
export type SourceTypeValue = (typeof SOURCE_TYPE_VALUES)[number]

export interface OrganizationRow {
  id: string
  name: string
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface ProfileRow {
  user_id: string
  org_id: string
  display_name: string
  role: RoleValue
  theme_preference: ThemeValue
  is_disabled: boolean
  created_at: string
  updated_at: string
}

export interface LeadTableRow {
  id: string
  org_id: string
  name: string
  is_archived: boolean
  default_stage: StageValue
  default_source_type: SourceTypeValue | null
  default_source_detail: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface LeadRow {
  id: string
  org_id: string
  table_id: string
  business_name: string
  stage: StageValue
  owner_id: string | null
  next_followup_at: string | null
  followup_window: FollowupWindowValue
  contact: string | null
  website_url: string | null
  domain: string | null
  notes: string | null
  source_type: SourceTypeValue
  source_detail: string | null
  last_touched_at: string | null
  do_not_contact: boolean
  dnc_reason: string | null
  lost_reason: string | null
  is_archived: boolean
  stage_changed_at: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}
