import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProfileOrThrow, requireAdmin } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { searchParamsToObject } from '@/lib/query'
import { adminCreateUserSchema } from '@/lib/validation/admin'
import { z } from 'zod'

const adminUsersListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const GET = withErrorHandling(async (request: Request) => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)
  requireAdmin(context)
  const url = new URL(request.url)
  const query = adminUsersListQuerySchema.parse(searchParamsToObject(url.searchParams))

  const { data, error, count } = await supabase
    .from('profiles')
    .select('user_id, display_name, role, theme_preference, is_disabled, created_at, updated_at', {
      count: 'exact',
    })
    .eq('org_id', context.profile.org_id)
    .order('created_at', { ascending: false })
    .range(query.offset, query.offset + query.limit - 1)

  if (error) {
    throw new ApiError(500, 'ADMIN_USER_LIST_FAILED', 'Failed to list users', error)
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

export const POST = withErrorHandling(async (request: Request) => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)
  requireAdmin(context)

  const payload = adminCreateUserSchema.parse(await request.json())

  const adminClient = createAdminSupabaseClient()

  const authResponse = payload.invite
    ? await adminClient.auth.admin.inviteUserByEmail(payload.email, {
        data: {
          display_name: payload.display_name,
          org_id: context.profile.org_id,
        },
      })
    : await adminClient.auth.admin.createUser({
        email: payload.email,
        password: payload.temp_password,
        email_confirm: true,
        user_metadata: {
          display_name: payload.display_name,
          org_id: context.profile.org_id,
        },
      })

  if (authResponse.error || !authResponse.data.user) {
    if (authResponse.error) {
      const message = authResponse.error.message ?? 'Failed to create auth user'
      const normalized = message.toLowerCase()

      if (normalized.includes('already been registered')) {
        throw new ApiError(409, 'ADMIN_USER_EXISTS', 'A user with this email already exists')
      }

      if (normalized.includes('password')) {
        throw new ApiError(400, 'INVALID_TEMP_PASSWORD', message)
      }

      throw new ApiError(500, 'ADMIN_USER_CREATE_FAILED', message, authResponse.error)
    }

    throw new ApiError(500, 'ADMIN_USER_CREATE_FAILED', 'Failed to create auth user')
  }

  const authUser = authResponse.data.user

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .insert({
      user_id: authUser.id,
      org_id: context.profile.org_id,
      display_name: payload.display_name,
      role: payload.role,
      theme_preference: 'system',
      is_disabled: false,
    })
    .select('*')
    .single()

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUser.id)
    throw new ApiError(500, 'ADMIN_PROFILE_CREATE_FAILED', 'Failed to create profile', profileError)
  }

  return ok(
    {
      item: {
        auth_user: {
          id: authUser.id,
          email: authUser.email,
        },
        profile,
      },
      temp_password: payload.invite ? null : payload.temp_password ?? null,
    },
    201,
  )
})
