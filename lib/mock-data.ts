import type {
  User,
  Org,
  SalesTable,
  Service,
  Lead,
  LeadEvent,
  Attachment,
  TablePermission,
} from "./types"

// ─── Organisation ────────────────────────────────────────────
export const mockOrg: Org = {
  id: "org-1",
  name: "Acme Sales Co.",
  logoUrl: null, // admin can set via branding
}

// ─── Users ───────────────────────────────────────────────────
export const mockUsers: User[] = [
  { id: "u1", name: "Alice Martin", email: "alice@acme.co", role: "admin" },
  { id: "u2", name: "Bob Johnson", email: "bob@acme.co", role: "sales" },
  { id: "u3", name: "Carol Lee", email: "carol@acme.co", role: "sales" },
  { id: "u4", name: "David Kim", email: "david@acme.co", role: "sales" },
  { id: "u5", name: "Emma Davis", email: "emma@acme.co", role: "sales" },
  { id: "u6", name: "Frank Wilson", email: "frank@acme.co", role: "sales" },
  { id: "u7", name: "Grace Chen", email: "grace@acme.co", role: "sales" },
]

// ─── Tables ──────────────────────────────────────────────────
export const mockTables: SalesTable[] = [
  {
    id: "t1",
    name: "Restaurant Leads",
    isArchived: false,
    defaults: { defaultStage: "New", defaultSourceType: "Instagram" },
  },
  {
    id: "t2",
    name: "E-commerce Leads",
    isArchived: false,
    defaults: { defaultStage: "New", defaultSourceType: "Meta Ads" },
  },
  {
    id: "t3",
    name: "SaaS Leads",
    isArchived: false,
    defaults: { defaultStage: "New", defaultSourceType: "Website" },
  },
]

// ─── Permissions ─────────────────────────────────────────────
export const mockPermissions: TablePermission[] = [
  // Admin (Alice) has edit on all tables
  { tableId: "t1", userId: "u1", access: "edit" },
  { tableId: "t2", userId: "u1", access: "edit" },
  { tableId: "t3", userId: "u1", access: "edit" },
  // Bob: edit t1, read t2
  { tableId: "t1", userId: "u2", access: "edit" },
  { tableId: "t2", userId: "u2", access: "read" },
  // Carol: edit t1, edit t3
  { tableId: "t1", userId: "u3", access: "edit" },
  { tableId: "t3", userId: "u3", access: "edit" },
  // David: edit t2
  { tableId: "t2", userId: "u4", access: "edit" },
  // Emma: edit t2, read t3
  { tableId: "t2", userId: "u5", access: "edit" },
  { tableId: "t3", userId: "u5", access: "read" },
  // Frank: edit t3
  { tableId: "t3", userId: "u6", access: "edit" },
  // Grace: read t1
  { tableId: "t1", userId: "u7", access: "read" },
]

// ─── Services ────────────────────────────────────────────────
export const mockServices: Service[] = [
  { id: "s1", tableId: "t1", name: "Social Media Management", isArchived: false },
  { id: "s2", tableId: "t1", name: "Website Design", isArchived: false },
  { id: "s3", tableId: "t1", name: "Photography", isArchived: false },
  { id: "s4", tableId: "t1", name: "Menu Design", isArchived: false },
  { id: "s5", tableId: "t2", name: "Shopify Setup", isArchived: false },
  { id: "s6", tableId: "t2", name: "Product Photography", isArchived: false },
  { id: "s7", tableId: "t2", name: "SEO Optimization", isArchived: false },
  { id: "s8", tableId: "t2", name: "Email Marketing", isArchived: false },
  { id: "s9", tableId: "t3", name: "Landing Page", isArchived: false },
  { id: "s10", tableId: "t3", name: "CRM Integration", isArchived: false },
  { id: "s11", tableId: "t3", name: "Analytics Setup", isArchived: false },
  { id: "s12", tableId: "t3", name: "API Development", isArchived: false },
]

// ─── Leads ───────────────────────────────────────────────────
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}
function daysFromNow(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

export const mockLeads: Lead[] = [
  // Table 1 – Restaurant Leads
  {
    id: "l1", tableId: "t1", businessName: "Bella Napoli", stage: "New",
    ownerId: null, nextFollowUpAt: null, followUpWindow: "Anytime",
    contact: "@bellanapoli_ig", websiteUrl: "https://bellanapoli.com",
    notes: "Found on Instagram, high engagement", sourceType: "Instagram",
    sourceDetail: "Explore page", interestedServices: ["s1", "s3"],
    lastTouchedAt: daysAgo(1), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(1), createdAt: daysAgo(5),
  },
  {
    id: "l2", tableId: "t1", businessName: "Sushi Express", stage: "Contacted",
    ownerId: "u2", nextFollowUpAt: daysAgo(1), followUpWindow: "Morning",
    contact: "hello@sushiexpress.com", websiteUrl: "https://sushiexpress.com",
    notes: "Sent IG DM. Interested in social media.", sourceType: "Instagram",
    sourceDetail: "Direct search", interestedServices: ["s1"],
    lastTouchedAt: daysAgo(2), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(3), createdAt: daysAgo(7),
  },
  {
    id: "l3", tableId: "t1", businessName: "Taco Fiesta", stage: "Replied",
    ownerId: "u2", nextFollowUpAt: daysFromNow(1), followUpWindow: "Afternoon",
    contact: "+1-555-0101", websiteUrl: "",
    notes: "Replied to DM. Asked for pricing.", sourceType: "Referral",
    sourceDetail: "From client Maria", interestedServices: ["s1", "s2"],
    lastTouchedAt: daysAgo(1), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(1), createdAt: daysAgo(10),
  },
  {
    id: "l4", tableId: "t1", businessName: "Green Leaf Cafe", stage: "Meeting",
    ownerId: "u3", nextFollowUpAt: daysFromNow(2), followUpWindow: "Morning",
    contact: "owner@greenleaf.cafe", websiteUrl: "https://greenleaf.cafe",
    notes: "Meeting scheduled for next week. Wants full package.",
    sourceType: "Website", sourceDetail: "", interestedServices: ["s1", "s2", "s3", "s4"],
    lastTouchedAt: daysAgo(0), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(3), createdAt: daysAgo(14),
  },
  {
    id: "l5", tableId: "t1", businessName: "Dragon Palace", stage: "Won",
    ownerId: "u2", nextFollowUpAt: null, followUpWindow: "Anytime",
    contact: "+1-555-0202", websiteUrl: "https://dragonpalace.com",
    notes: "Signed contract for social + photography.", sourceType: "Instagram",
    sourceDetail: "Sponsored post", interestedServices: ["s1", "s3"],
    lastTouchedAt: daysAgo(5), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(5), createdAt: daysAgo(30),
  },
  {
    id: "l6", tableId: "t1", businessName: "Burger Barn", stage: "Lost",
    ownerId: "u3", nextFollowUpAt: null, followUpWindow: "Anytime",
    contact: "info@burgerbarn.com", websiteUrl: "https://burgerbarn.com",
    notes: "Went with competitor", sourceType: "Meta Ads",
    sourceDetail: "Lead form", interestedServices: ["s2"],
    lastTouchedAt: daysAgo(10), doNotContact: false, dncReason: "",
    lostReason: "Chose cheaper competitor", isArchived: false, stageChangedAt: daysAgo(10), createdAt: daysAgo(20),
  },
  {
    id: "l7", tableId: "t1", businessName: "Pasta Paradise", stage: "New",
    ownerId: null, nextFollowUpAt: null, followUpWindow: "Anytime",
    contact: "@pasta_paradise", websiteUrl: "",
    notes: "", sourceType: "Scraping", sourceDetail: "Google Maps",
    interestedServices: [],
    lastTouchedAt: daysAgo(0), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(0), createdAt: daysAgo(1),
  },
  // Table 2 – E-commerce Leads
  {
    id: "l8", tableId: "t2", businessName: "StyleHub", stage: "New",
    ownerId: null, nextFollowUpAt: null, followUpWindow: "Anytime",
    contact: "team@stylehub.co", websiteUrl: "https://stylehub.co",
    notes: "High potential ecommerce brand", sourceType: "Meta Ads",
    sourceDetail: "Facebook lead ad", interestedServices: ["s5", "s7"],
    lastTouchedAt: daysAgo(0), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(0), createdAt: daysAgo(2),
  },
  {
    id: "l9", tableId: "t2", businessName: "PetMart Online", stage: "Contacted",
    ownerId: "u4", nextFollowUpAt: daysAgo(2), followUpWindow: "Morning",
    contact: "+1-555-0303", websiteUrl: "https://petmart.online",
    notes: "Called. Owner interested. Follow up with proposal.", sourceType: "Referral",
    sourceDetail: "David's network", interestedServices: ["s5", "s6", "s8"],
    lastTouchedAt: daysAgo(3), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(4), createdAt: daysAgo(12),
  },
  {
    id: "l10", tableId: "t2", businessName: "Gadget Galaxy", stage: "Proposal",
    ownerId: "u5", nextFollowUpAt: daysFromNow(0), followUpWindow: "Afternoon",
    contact: "sales@gadgetgalaxy.io", websiteUrl: "https://gadgetgalaxy.io",
    notes: "Proposal sent. Waiting for sign-off.", sourceType: "Website",
    sourceDetail: "Contact form", interestedServices: ["s5", "s7", "s8"],
    lastTouchedAt: daysAgo(1), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(2), createdAt: daysAgo(18),
  },
  {
    id: "l11", tableId: "t2", businessName: "Craft Corner", stage: "Won",
    ownerId: "u4", nextFollowUpAt: null, followUpWindow: "Anytime",
    contact: "hello@craftcorner.com", websiteUrl: "https://craftcorner.com",
    notes: "Signed! Shopify + email marketing.", sourceType: "Instagram",
    sourceDetail: "Story ad", interestedServices: ["s5", "s8"],
    lastTouchedAt: daysAgo(7), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(7), createdAt: daysAgo(25),
  },
  {
    id: "l12", tableId: "t2", businessName: "Vintage Finds", stage: "New",
    ownerId: null, nextFollowUpAt: null, followUpWindow: "Anytime",
    contact: "@vintagefinds_shop", websiteUrl: "",
    notes: "", sourceType: "Instagram", sourceDetail: "Hashtag search",
    interestedServices: ["s6"],
    lastTouchedAt: daysAgo(0), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(0), createdAt: daysAgo(1),
  },
  {
    id: "l13", tableId: "t2", businessName: "NoReach Inc.", stage: "Contacted",
    ownerId: "u5", nextFollowUpAt: daysAgo(5), followUpWindow: "Anytime",
    contact: "noreply@noreach.com", websiteUrl: "",
    notes: "Emailed twice, no response.", sourceType: "Scraping",
    sourceDetail: "LinkedIn", interestedServices: [],
    lastTouchedAt: daysAgo(6), doNotContact: true, dncReason: "Unresponsive after multiple attempts",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(8), createdAt: daysAgo(15),
  },
  // Table 3 – SaaS Leads
  {
    id: "l14", tableId: "t3", businessName: "CloudSync Pro", stage: "New",
    ownerId: null, nextFollowUpAt: null, followUpWindow: "Anytime",
    contact: "cto@cloudsync.pro", websiteUrl: "https://cloudsync.pro",
    notes: "CTO expressed interest at conference", sourceType: "Other",
    sourceDetail: "Tech conference", interestedServices: ["s10", "s11"],
    lastTouchedAt: daysAgo(1), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(1), createdAt: daysAgo(3),
  },
  {
    id: "l15", tableId: "t3", businessName: "DataPipe", stage: "Contacted",
    ownerId: "u6", nextFollowUpAt: daysFromNow(1), followUpWindow: "Morning",
    contact: "+1-555-0404", websiteUrl: "https://datapipe.dev",
    notes: "Initial call done. Very interested in API dev.", sourceType: "Website",
    sourceDetail: "Blog post CTA", interestedServices: ["s12"],
    lastTouchedAt: daysAgo(2), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(2), createdAt: daysAgo(8),
  },
  {
    id: "l16", tableId: "t3", businessName: "MetricFlow", stage: "Meeting",
    ownerId: "u3", nextFollowUpAt: daysFromNow(3), followUpWindow: "Afternoon",
    contact: "ceo@metricflow.io", websiteUrl: "https://metricflow.io",
    notes: "Demo scheduled. Need to prepare custom analytics pitch.",
    sourceType: "Referral", sourceDetail: "Partner intro",
    interestedServices: ["s9", "s11"],
    lastTouchedAt: daysAgo(1), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(3), createdAt: daysAgo(15),
  },
  {
    id: "l17", tableId: "t3", businessName: "QuickDeploy", stage: "Won",
    ownerId: "u6", nextFollowUpAt: null, followUpWindow: "Anytime",
    contact: "ops@quickdeploy.app", websiteUrl: "https://quickdeploy.app",
    notes: "Closed! Full package landing page + CRM + analytics.",
    sourceType: "Website", sourceDetail: "Pricing page",
    interestedServices: ["s9", "s10", "s11"],
    lastTouchedAt: daysAgo(4), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(4), createdAt: daysAgo(22),
  },
  {
    id: "l18", tableId: "t3", businessName: "LegacyTech", stage: "Lost",
    ownerId: "u3", nextFollowUpAt: null, followUpWindow: "Anytime",
    contact: "info@legacytech.net", websiteUrl: "https://legacytech.net",
    notes: "Budget constraints. May revisit Q3.", sourceType: "Meta Ads",
    sourceDetail: "", interestedServices: ["s9"],
    lastTouchedAt: daysAgo(12), doNotContact: false, dncReason: "",
    lostReason: "Budget constraints", isArchived: false, stageChangedAt: daysAgo(12), createdAt: daysAgo(28),
  },
  {
    id: "l19", tableId: "t3", businessName: "NexGen AI", stage: "Proposal",
    ownerId: "u6", nextFollowUpAt: daysAgo(1), followUpWindow: "Morning",
    contact: "founders@nexgenai.com", websiteUrl: "https://nexgenai.com",
    notes: "Reviewing proposal. High value deal.", sourceType: "Referral",
    sourceDetail: "Investor intro", interestedServices: ["s9", "s10", "s11", "s12"],
    lastTouchedAt: daysAgo(2), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(3), createdAt: daysAgo(16),
  },
  {
    id: "l20", tableId: "t1", businessName: "Closed Kitchen", stage: "New",
    ownerId: null, nextFollowUpAt: null, followUpWindow: "Anytime",
    contact: "", websiteUrl: "https://closedkitchen.com",
    notes: "Ghost kitchen. No social presence.", sourceType: "Unknown",
    sourceDetail: "", interestedServices: ["s1"],
    lastTouchedAt: daysAgo(0), doNotContact: false, dncReason: "",
    lostReason: "", isArchived: false, stageChangedAt: daysAgo(0), createdAt: daysAgo(0),
  },
]

// ─── Lead Events ─────────────────────────────────────────────
export const mockLeadEvents: LeadEvent[] = [
  { id: "e1", leadId: "l2", type: "stage_change", byUser: "u2", createdAt: daysAgo(3), meta: { from: "New", to: "Contacted" } },
  { id: "e2", leadId: "l3", type: "stage_change", byUser: "u2", createdAt: daysAgo(1), meta: { from: "Contacted", to: "Replied" } },
  { id: "e3", leadId: "l4", type: "owner_change", byUser: "u3", createdAt: daysAgo(10), meta: { from: "", to: "u3" } },
  { id: "e4", leadId: "l5", type: "stage_change", byUser: "u2", createdAt: daysAgo(5), meta: { from: "Proposal", to: "Won" } },
  { id: "e5", leadId: "l9", type: "touch_logged", byUser: "u4", createdAt: daysAgo(3), meta: { note: "Called. Owner interested." } },
  { id: "e6", leadId: "l13", type: "dnc_change", byUser: "u5", createdAt: daysAgo(6), meta: { value: "true", reason: "Unresponsive" } },
]

// ─── Attachments ─────────────────────────────────────────────
export const mockAttachments: Attachment[] = [
  { id: "a1", leadId: "l4", filename: "proposal_greenleaf.pdf", url: "#", uploadedBy: "u3", createdAt: daysAgo(3) },
  { id: "a2", leadId: "l10", filename: "gadget_galaxy_brief.docx", url: "#", uploadedBy: "u5", createdAt: daysAgo(2) },
]

// ─── Favorites (per user) ────────────────────────────────────
export const mockFavorites: Record<string, string[]> = {
  u1: ["t1"],
  u2: ["t1"],
  u3: ["t1", "t3"],
  u4: ["t2"],
  u5: ["t2"],
  u6: ["t3"],
  u7: ["t1"],
}
