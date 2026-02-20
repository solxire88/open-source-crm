import type { SupabaseClient } from '@supabase/supabase-js'

import { ApiError } from '@/lib/http'

interface AnalyticsParams {
  range: '7d' | '30d' | '90d' | 'all'
  tableIds?: string[]
  ownerId?: string
}

export const getAnalyticsSnapshot = async (
  supabase: SupabaseClient,
  { range, tableIds, ownerId }: AnalyticsParams,
) => {
  const { data, error } = await supabase.rpc('analytics_snapshot', {
    p_range: range,
    p_table_ids: tableIds && tableIds.length > 0 ? tableIds : null,
    p_owner_id: ownerId ?? null,
  })

  if (error) {
    throw new ApiError(500, 'ANALYTICS_ERROR', 'Failed to compute analytics', error)
  }

  return data
}
