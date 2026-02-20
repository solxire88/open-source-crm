// ============================================================
// Sales Management Platform — Type definitions
// ============================================================

export type Role = "admin" | "sales"

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatarUrl?: string
}

export interface Org {
  id: string
  name: string
  logoUrl: string | null
}

export type Stage =
  | "New"
  | "Contacted"
  | "Replied"
  | "Meeting"
  | "Proposal"
  | "Won"
  | "Lost"

export const STAGES: Stage[] = [
  "New",
  "Contacted",
  "Replied",
  "Meeting",
  "Proposal",
  "Won",
  "Lost",
]

export type SourceType =
  | "Instagram"
  | "Meta Ads"
  | "Scraping"
  | "Referral"
  | "Website"
  | "Other"
  | "Unknown"

export const SOURCE_TYPES: SourceType[] = [
  "Instagram",
  "Meta Ads",
  "Scraping",
  "Referral",
  "Website",
  "Other",
  "Unknown",
]

export type FollowUpWindow = "Morning" | "Afternoon" | "Anytime"

export const FOLLOW_UP_WINDOWS: FollowUpWindow[] = [
  "Morning",
  "Afternoon",
  "Anytime",
]

export type AccessLevel = "read" | "edit"

export interface TablePermission {
  tableId: string
  userId: string
  access: AccessLevel
}

export interface SalesTable {
  id: string
  name: string
  isArchived: boolean
  defaults: {
    defaultStage: Stage
    defaultSourceType: SourceType
    defaultSourceDetail?: string
  }
}

export interface Service {
  id: string
  tableId: string
  name: string
  isArchived: boolean
}

export interface Lead {
  id: string
  tableId: string
  businessName: string
  stage: Stage
  ownerId: string | null
  nextFollowUpAt: string | null
  followUpWindow: FollowUpWindow
  contact: string
  websiteUrl: string
  notes: string
  sourceType: SourceType
  sourceDetail: string
  interestedServices: string[]
  lastTouchedAt: string
  doNotContact: boolean
  dncReason: string
  lostReason: string
  isArchived: boolean
  stageChangedAt: string
  createdAt: string
  isPinned?: boolean
}

export type LeadEventType =
  | "stage_change"
  | "owner_change"
  | "follow_up_change"
  | "dnc_change"
  | "services_change"
  | "import"
  | "merge"
  | "note_added"
  | "touch_logged"

export interface LeadEvent {
  id: string
  leadId: string
  type: LeadEventType
  byUser: string
  createdAt: string
  meta: Record<string, string>
}

export interface Attachment {
  id: string
  leadId: string
  filename: string
  url: string
  uploadedBy: string
  createdAt: string
}

export interface SavedFilter {
  id: string
  tableId: string
  userId: string
  name: string
  filters: Record<string, string>
  sort?: string
}
