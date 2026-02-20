import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { searchParamsToObject } from '@/lib/query'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { usersListQuerySchema } from '@/lib/validation/users'
import { getProfileOrThrow } from '@/lib/auth'

export const GET = withErrorHandling(async (request: Request) => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  const url = new URL(request.url)
  const query = usersListQuerySchema.parse(searchParamsToObject(url.searchParams))

  const { data, error, count } = await supabase
    .from('profiles')
    .select(
      'user_id, display_name, role, is_disabled, theme_preference, created_at, updated_at',
      {
        count: 'exact',
      },
    )
    .eq('org_id', context.profile.org_id)
    .order('display_name', { ascending: true })
    .range(query.offset, query.offset + query.limit - 1)

  if (error) {
    throw new ApiError(500, 'USER_LIST_FAILED', 'Failed to list users', error)
  }

  return ok({
    items: data ?? [],
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: count ?? 0,
    },
  })
})

