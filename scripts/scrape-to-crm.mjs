import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import { createClient } from '@supabase/supabase-js'

const loadEnvFile = (filepath) => {
  const absolute = resolve(process.cwd(), filepath)
  if (!existsSync(absolute)) return

  const content = readFileSync(absolute, 'utf8')
  content.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) return

    const key = trimmed.slice(0, eqIndex).trim()
    if (!key || process.env[key] !== undefined) return

    let value = trimmed.slice(eqIndex + 1).trim()
    const hasQuotes =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    if (hasQuotes) value = value.slice(1, -1)
    process.env[key] = value
  })
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const args = process.argv.slice(2)
const arg = (name, fallback = '') => {
  const index = args.indexOf(name)
  if (index === -1 || index + 1 >= args.length) return fallback
  return args[index + 1]
}
const hasFlag = (name) => args.includes(name)

const toBoolean = (value, fallback) => {
  if (!value) return fallback
  return /^(1|true|yes)$/i.test(value)
}

const DRY_RUN = hasFlag('--write')
  ? false
  : toBoolean(arg('--dry-run', process.env.SCRAPE_DRY_RUN ?? 'true'), true)

const DELAY_MS = Number(arg('--delay-ms', process.env.SCRAPE_DELAY_MS ?? '1200'))
const MAX_RETRIES = Number(arg('--retries', process.env.SCRAPE_RETRIES ?? '3'))
const USER_AGENT =
  arg('--user-agent', process.env.SCRAPE_USER_AGENT) ||
  'OpenSourceCRM-Scraper/1.0 (+https://github.com/your-org/your-repo)'

const TABLE_ID = arg('--table-id', process.env.SCRAPE_TABLE_ID ?? '')
const ACTOR_USER_ID = arg('--actor-user-id', process.env.SCRAPE_ACTOR_USER_ID ?? '')

const showUsage = () => {
  console.log(`
Usage:
  node scripts/scrape-to-crm.mjs --input samples/scrape-urls.csv
  node scripts/scrape-to-crm.mjs --urls https://example.com,https://example.org --dry-run true
  node scripts/scrape-to-crm.mjs --input samples/scrape-urls.csv --write --table-id <uuid> --actor-user-id <uuid>

Notes:
  - Dry run is ON by default.
  - Use --write to insert into Supabase.
  - Respect robots.txt and Terms of Service for every domain.
`)
}

if (hasFlag('--help')) {
  showUsage()
  process.exit(0)
}

const parseUrlsFromCsv = (filepath) => {
  const absolute = resolve(process.cwd(), filepath)
  if (!existsSync(absolute)) {
    throw new Error(`Input file not found: ${filepath}`)
  }

  const content = readFileSync(absolute, 'utf8')
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const header = lines[0].split(',').map((cell) => cell.trim().toLowerCase())
  const urlIndex = header.indexOf('url')

  if (urlIndex === -1) {
    return lines
      .map((line) => line.split(',')[0]?.trim())
      .filter(Boolean)
  }

  return lines
    .slice(1)
    .map((line) => line.split(',')[urlIndex]?.trim())
    .filter(Boolean)
}

const normalizeUrl = (value) => {
  if (!value) return null
  const input = value.trim()
  if (!input) return null

  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`
  try {
    const parsed = new URL(withProtocol)
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

const sanitizeTitle = (title) => {
  if (!title) return ''
  return title
    .replace(/\s+/g, ' ')
    .replace(/\s+[|:-]\s+.*/g, '')
    .trim()
}

const extractLeadFromHtml = (url, html) => {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = sanitizeTitle(titleMatch?.[1] ?? '')
  const emailMatch = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const descriptionMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  )

  const website = normalizeUrl(url)
  if (!website) return null

  const hostname = new URL(website).hostname.replace(/^www\./i, '')
  const companyName = title || hostname
  const contact = emailMatch ? emailMatch[0].toLowerCase() : null
  const notes = descriptionMatch?.[1] ?? `Imported by scrape script from ${website}`

  if (!companyName || companyName.length < 2) {
    return null
  }

  return {
    business_name: companyName.slice(0, 180),
    contact,
    website_url: website,
    notes: notes.slice(0, 4000),
  }
}

const fetchWithRetry = async (url) => {
  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return await response.text()
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES) {
        await sleep(Math.min(500 * attempt, 2000))
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`)
}

const collectUrls = () => {
  const fromInline = arg('--urls', '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const fromFile = (() => {
    const filepath = arg('--input', '')
    if (!filepath) return []
    return parseUrlsFromCsv(filepath)
  })()

  const combined = [...fromInline, ...fromFile]
  const normalized = combined
    .map(normalizeUrl)
    .filter((value) => Boolean(value))

  return Array.from(new Set(normalized))
}

const main = async () => {
  const urls = collectUrls()
  if (urls.length === 0) {
    showUsage()
    throw new Error('No URLs provided.')
  }

  console.log(`Found ${urls.length} URLs. Dry run: ${DRY_RUN ? 'yes' : 'no'}.`)

  const scraped = []
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index]
    try {
      const html = await fetchWithRetry(url)
      const lead = extractLeadFromHtml(url, html)
      if (lead) {
        scraped.push(lead)
        console.log(`[${index + 1}/${urls.length}] OK ${url} -> ${lead.business_name}`)
      } else {
        console.log(`[${index + 1}/${urls.length}] SKIP ${url} (insufficient data)`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`[${index + 1}/${urls.length}] FAIL ${url} (${message})`)
    }
    await sleep(DELAY_MS)
  }

  const deduped = []
  const seen = new Set()
  for (const lead of scraped) {
    const key = `${lead.business_name.toLowerCase()}|${lead.website_url.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(lead)
    }
  }

  console.log(`Prepared ${deduped.length} unique lead records.`)
  console.log(
    JSON.stringify(
      deduped.slice(0, 5).map((lead) => ({
        business_name: lead.business_name,
        contact: lead.contact,
        website_url: lead.website_url,
      })),
      null,
      2,
    ),
  )

  if (DRY_RUN) {
    console.log('Dry run complete. No database writes were made.')
    return
  }

  if (!TABLE_ID || !ACTOR_USER_ID) {
    throw new Error(
      'Write mode requires --table-id and --actor-user-id (or SCRAPE_TABLE_ID / SCRAPE_ACTOR_USER_ID env vars).',
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    )
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: table, error: tableError } = await client
    .from('lead_tables')
    .select('id, org_id')
    .eq('id', TABLE_ID)
    .single()

  if (tableError || !table) {
    throw tableError ?? new Error('Table not found for provided table id.')
  }

  const insertRows = deduped.map((lead) => ({
    org_id: table.org_id,
    table_id: table.id,
    business_name: lead.business_name,
    stage: 'New',
    owner_id: null,
    next_followup_at: null,
    followup_window: 'Anytime',
    contact: lead.contact,
    website_url: lead.website_url,
    notes: lead.notes,
    source_type: 'Scraping',
    source_detail: 'script:scrape-to-crm',
    do_not_contact: false,
    is_archived: false,
    created_by: ACTOR_USER_ID,
    updated_by: ACTOR_USER_ID,
  }))

  if (insertRows.length === 0) {
    console.log('Nothing to insert.')
    return
  }

  const { data: inserted, error: insertError } = await client
    .from('leads')
    .insert(insertRows)
    .select('id')

  if (insertError) {
    throw insertError
  }

  console.log(`Inserted ${inserted?.length ?? 0} leads into table ${TABLE_ID}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

