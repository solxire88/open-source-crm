const PROTOCOL_RE = /^https?:\/\//i
const WWW_RE = /^www\./i

export const normalizeWhitespace = (value: string | null | undefined) => {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export const normalizeWebsiteUrl = (value: string | null | undefined) => {
  const cleaned = normalizeWhitespace(value)
  if (!cleaned) return null

  const normalized = PROTOCOL_RE.test(cleaned) ? cleaned : `https://${cleaned}`
  try {
    const url = new URL(normalized)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return cleaned
  }
}

export const extractDomain = (websiteUrl: string | null | undefined) => {
  const normalized = normalizeWebsiteUrl(websiteUrl)
  if (!normalized) return null

  try {
    const hostname = new URL(normalized).hostname.toLowerCase()
    return hostname.replace(WWW_RE, '')
  } catch {
    return normalized
      .toLowerCase()
      .replace(PROTOCOL_RE, '')
      .replace(WWW_RE, '')
      .split('/')[0]
      .trim() || null
  }
}

export const sanitizeFilename = (filename: string) => {
  const base = filename.trim().replace(/\s+/g, '_')
  return base.replace(/[^a-zA-Z0-9_.-]/g, '') || 'file'
}

export const appendTimestampedNote = (
  previousNotes: string | null | undefined,
  note: string,
  actorName?: string,
) => {
  const cleaned = note.trim()
  if (!cleaned) {
    return previousNotes ?? null
  }

  const stamp = new Date().toISOString()
  const label = actorName ? `${actorName}: ` : ''
  const line = `${stamp} - ${label}${cleaned}`

  if (!previousNotes || previousNotes.trim().length === 0) {
    return line
  }

  return `${previousNotes}\n${line}`
}
