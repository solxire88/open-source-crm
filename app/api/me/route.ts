import { ok, withErrorHandling } from '@/lib/http'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProfileOrThrow } from '@/lib/auth'

const ORG_ASSETS_BUCKET = 'org_assets'

export const GET = withErrorHandling(async () => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)
  const logoPath = context.org.logo_url
  const isStoragePath = Boolean(logoPath && !/^https?:\/\//i.test(logoPath))

  let logoSignedUrl: string | null = null
  if (logoPath && isStoragePath) {
    const { data } = await supabase.storage
      .from(ORG_ASSETS_BUCKET)
      .createSignedUrl(logoPath, 60 * 60)
    logoSignedUrl = data?.signedUrl ?? null
  }

  return ok({
    user: {
      id: context.user.id,
      email: context.user.email,
    },
    profile: context.profile,
    organization: {
      ...context.org,
      logo_signed_url: logoPath && !isStoragePath ? logoPath : logoSignedUrl,
    },
  })
})
