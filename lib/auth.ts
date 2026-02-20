import type { SupabaseClient, User } from '@supabase/supabase-js'

import type {
  LeadRow,
  LeadTableRow,
  OrganizationRow,
  ProfileRow,
} from '@/lib/backend-types'
import { ApiError, forbidden, notFound, unauthorized } from '@/lib/http'

export interface AuthContext {
  user: User
  profile: ProfileRow
  org: OrganizationRow
  supabase: SupabaseClient
}

export const getProfileOrThrow = async (
  supabase: SupabaseClient,
): Promise<AuthContext> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    unauthorized('Authentication required')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const typedProfile = profile as ProfileRow | null

  if (profileError) {
    throw new ApiError(401, 'PROFILE_LOOKUP_FAILED', 'Failed to load profile', profileError)
  }

  if (!typedProfile) {
    unauthorized('Profile not found')
  }
  const profileRow: ProfileRow = typedProfile!

  if (profileRow.is_disabled) {
    forbidden('User account is disabled')
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profileRow.org_id)
    .maybeSingle()

  const typedOrg = org as OrganizationRow | null

  if (orgError) {
    throw new ApiError(500, 'ORG_LOOKUP_FAILED', 'Failed to lookup organization', orgError)
  }

  if (!typedOrg) {
    notFound('Organization not found')
  }
  const orgRow: OrganizationRow = typedOrg!

  return {
    user,
    profile: profileRow,
    org: orgRow,
    supabase,
  }
}

export const requireAdmin = (context: AuthContext) => {
  if (context.profile.role !== 'admin') {
    forbidden('Admin access required')
  }
}

export const requireTableRead = async (
  context: AuthContext,
  tableId: string,
): Promise<LeadTableRow> => {
  const { data: table, error } = await context.supabase
    .from('lead_tables')
    .select('*')
    .eq('id', tableId)
    .maybeSingle()

  const typedTable = table as LeadTableRow | null

  if (error) {
    throw new ApiError(500, 'TABLE_LOOKUP_FAILED', 'Failed to lookup table', error)
  }

  if (!typedTable) {
    notFound('Table not found')
  }

  return typedTable as LeadTableRow
}

export const requireTableEdit = async (
  context: AuthContext,
  tableId: string,
): Promise<LeadTableRow> => {
  const table = await requireTableRead(context, tableId)

  if (context.profile.role === 'admin') {
    return table
  }

  const { data: canEdit, error } = await context.supabase.rpc('can_edit_table', {
    p_table_id: tableId,
  })

  if (error) {
    throw new ApiError(500, 'TABLE_PERMISSION_CHECK_FAILED', 'Failed permission check', error)
  }

  if (!canEdit) {
    forbidden('Edit access required')
  }

  return table
}

export const requireLeadRead = async (
  context: AuthContext,
  leadId: string,
): Promise<LeadRow> => {
  const { data: lead, error } = await context.supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()

  const typedLead = lead as LeadRow | null

  if (error) {
    throw new ApiError(500, 'LEAD_LOOKUP_FAILED', 'Failed to lookup lead', error)
  }

  if (!typedLead) {
    notFound('Lead not found')
  }

  return typedLead as LeadRow
}

export const requireLeadEdit = async (
  context: AuthContext,
  leadId: string,
): Promise<LeadRow> => {
  const lead = await requireLeadRead(context, leadId)
  await requireTableEdit(context, lead.table_id)
  return lead
}

export const ensureLeadIdsBelongTable = async (
  context: AuthContext,
  tableId: string,
  leadIds: string[],
) => {
  if (leadIds.length === 0) {
    return
  }

  const { data, error } = await context.supabase
    .from('leads')
    .select('id')
    .eq('table_id', tableId)
    .in('id', leadIds)

  if (error) {
    throw new ApiError(500, 'LEAD_SCOPE_CHECK_FAILED', 'Failed to verify lead scope', error)
  }

  const foundIds = new Set((data ?? []).map((row: { id: string }) => String(row.id)))
  const missing = leadIds.filter((id) => !foundIds.has(id))

  if (missing.length > 0) {
    notFound('One or more leads were not found')
  }
}

export const ensureServiceIdsBelongTable = async (
  context: AuthContext,
  tableId: string,
  serviceIds: string[],
) => {
  if (serviceIds.length === 0) {
    return
  }

  const { data, error } = await context.supabase
    .from('table_services')
    .select('id')
    .eq('table_id', tableId)
    .in('id', serviceIds)

  if (error) {
    throw new ApiError(
      500,
      'SERVICE_SCOPE_CHECK_FAILED',
      'Failed to verify service scope',
      error,
    )
  }

  const foundIds = new Set((data ?? []).map((row: { id: string }) => String(row.id)))
  const missing = serviceIds.filter((id) => !foundIds.has(id))

  if (missing.length > 0) {
    throw new ApiError(400, 'INVALID_SERVICE_IDS', 'One or more service ids are invalid')
  }
}
