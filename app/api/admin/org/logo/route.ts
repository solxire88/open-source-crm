import { randomUUID } from 'crypto'

import { getProfileOrThrow, requireAdmin } from '@/lib/auth'
import { ApiError, ok, withErrorHandling } from '@/lib/http'
import { sanitizeFilename } from '@/lib/leads'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const ORG_ASSETS_BUCKET = 'org_assets'

export const POST = withErrorHandling(async (request: Request) => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  requireAdmin(context)

  const formData = await request.formData()
  const fileEntry = formData.get('file')

  if (!(fileEntry instanceof File)) {
    throw new ApiError(400, 'BAD_REQUEST', 'file is required in multipart form-data')
  }
  const file: File = fileEntry

  const adminClient = createAdminSupabaseClient()

  const path = `${context.profile.org_id}/logo/${randomUUID()}-${sanitizeFilename(file.name)}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await adminClient.storage
    .from(ORG_ASSETS_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type || undefined,
      upsert: false,
    })

  if (uploadError) {
    throw new ApiError(500, 'ORG_LOGO_UPLOAD_FAILED', 'Failed to upload logo', uploadError)
  }

  const { data: org, error: orgUpdateError } = await adminClient
    .from('organizations')
    .update({ logo_url: path })
    .eq('id', context.profile.org_id)
    .select('*')
    .single()

  if (orgUpdateError) {
    throw new ApiError(500, 'ORG_LOGO_UPDATE_FAILED', 'Failed to update organization logo', orgUpdateError)
  }

  const { data: signedData } = await adminClient.storage
    .from(ORG_ASSETS_BUCKET)
    .createSignedUrl(path, 60 * 60)

  return ok({
    organization: org,
    logo: {
      storage_path: path,
      signed_url: signedData?.signedUrl ?? null,
    },
  })
})

export const DELETE = withErrorHandling(async () => {
  const supabase = await createServerSupabaseClient()
  const context = await getProfileOrThrow(supabase)

  requireAdmin(context)

  const adminClient = createAdminSupabaseClient()

  const { data: org, error: orgLookupError } = await adminClient
    .from('organizations')
    .select('id, logo_url')
    .eq('id', context.profile.org_id)
    .single()

  if (orgLookupError || !org) {
    throw new ApiError(500, 'ORG_LOGO_LOOKUP_FAILED', 'Failed to lookup organization', orgLookupError)
  }

  const logoPath = (org as { logo_url: string | null }).logo_url
  if (logoPath) {
    await adminClient.storage.from(ORG_ASSETS_BUCKET).remove([logoPath])
  }

  const { data: updatedOrg, error: orgUpdateError } = await adminClient
    .from('organizations')
    .update({ logo_url: null })
    .eq('id', context.profile.org_id)
    .select('*')
    .single()

  if (orgUpdateError) {
    throw new ApiError(500, 'ORG_LOGO_REMOVE_FAILED', 'Failed to remove logo', orgUpdateError)
  }

  return ok({ organization: updatedOrg })
})
