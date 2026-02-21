import { ApiError, ok, withErrorHandling } from "@/lib/http"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"

const ORG_ASSETS_BUCKET = "org_assets"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(async () => {
  const supabase = createAdminSupabaseClient()

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("id, name, logo_url, created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, "BRANDING_FETCH_FAILED", "Failed to load branding", error)
  }

  if (!organization) {
    return ok({ organization: null })
  }

  const logoPath = organization.logo_url
  const isExternalUrl = Boolean(logoPath && /^https?:\/\//i.test(logoPath))

  let logoSignedUrl: string | null = null
  if (logoPath && !isExternalUrl) {
    const { data: signed, error: signedError } = await supabase.storage
      .from(ORG_ASSETS_BUCKET)
      .createSignedUrl(logoPath, 60 * 60)

    if (signedError) {
      throw new ApiError(
        500,
        "BRANDING_LOGO_SIGN_FAILED",
        "Failed to sign organization logo URL",
        signedError,
      )
    }

    logoSignedUrl = signed?.signedUrl ?? null
  }

  return ok({
    organization: {
      id: organization.id,
      name: organization.name,
      logo_url: organization.logo_url,
      logo_signed_url: isExternalUrl ? logoPath : logoSignedUrl,
    },
  })
})
