import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
    if (hasQuotes) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  })
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage:
  npm run seed

Optional env vars:
  SEED_ORG_NAME=Acme Sales Org
  SEED_ADMIN_EMAIL=admin@example.dev
  SEED_ADMIN_PASSWORD=ChangeMe123!
  SEED_DEFAULT_PASSWORD=ChangeMe123!
  SEED_RESET_PASSWORDS=true   # reset existing users' passwords
`)
  process.exit(0)
}

const requireEnv = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill required values.`,
    )
  }
  return value
}

const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceRole = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

const admin = createClient(url, serviceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const ORG_NAME = process.env.SEED_ORG_NAME ?? 'Acme Sales Org'
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@acme-crm.dev'
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'ChangeMe123!'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_PASSWORD
const RESET_PASSWORDS = /^(1|true|yes)$/i.test(
  process.env.SEED_RESET_PASSWORDS ?? 'false',
)

const USERS = [
  {
    email: ADMIN_EMAIL,
    display_name: 'Admin User',
    role: 'admin',
    password: ADMIN_PASSWORD,
  },
  ...Array.from({ length: 6 }).map((_, index) => ({
    email: `sales${index + 1}@acme-crm.dev`,
    display_name: `Sales ${index + 1}`,
    role: 'sales',
    password: DEFAULT_PASSWORD,
  })),
]

const TABLES = ['US SMB', 'Enterprise', 'Outbound Experiments']
const SERVICES_BY_TABLE = {
  'US SMB': ['Web Design', 'SEO', 'Lead Gen'],
  Enterprise: ['RevOps', 'Paid Media', 'Creative Studio'],
  'Outbound Experiments': ['Cold Outreach', 'Data Enrichment', 'Automation'],
}

const STAGES = ['New', 'Contacted', 'Replied', 'Meeting', 'Proposal', 'Won', 'Lost']
const SOURCES = ['Instagram', 'Meta Ads', 'Scraping', 'Referral', 'Website', 'Other', 'Unknown']

const listAllUsers = async () => {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) {
    throw listed.error
  }
  return listed.data.users
}

const ensureOrg = async () => {
  const { data: existingOrgs, error: existingError } = await admin
    .from('organizations')
    .select('*')
    .eq('name', ORG_NAME)
    .order('created_at', { ascending: true })
    .limit(1)

  if (existingError) {
    throw existingError
  }

  const existing = existingOrgs?.[0]
  if (existing) return existing

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: ORG_NAME,
    })
    .select('*')
    .single()

  if (orgError || !org) {
    throw orgError ?? new Error('Failed to create organization')
  }

  return org
}

const ensureUser = async ({
  email,
  displayName,
  password,
}) => {
  const users = await listAllUsers()
  const existing = users.find((user) => user.email?.toLowerCase() === email.toLowerCase())

  if (existing) {
    let passwordSet = false
    if (RESET_PASSWORDS) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          display_name: displayName,
        },
      })
      if (updateError) {
        throw updateError
      }
      passwordSet = true
    }

    return {
      user: existing,
      created: false,
      passwordSet,
    }
  }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
    },
  })

  if (created.error || !created.data.user) {
    throw created.error ?? new Error('Failed to create user')
  }

  return {
    user: created.data.user,
    created: true,
    passwordSet: true,
  }
}

const ensureServices = async (orgId, tables) => {
  const tableIdToNames = new Map(
    tables.map((table) => [table.id, SERVICES_BY_TABLE[table.name] ?? ['General Consulting']]),
  )

  const tableIds = tables.map((table) => table.id)
  const { data: existing, error: existingError } = await admin
    .from('table_services')
    .select('id, table_id, name')
    .in('table_id', tableIds.length > 0 ? tableIds : ['00000000-0000-0000-0000-000000000000'])

  if (existingError) {
    throw existingError
  }

  const seen = new Set(
    (existing ?? []).map((row) => `${row.table_id}:${String(row.name).toLowerCase()}`),
  )

  const toInsert = []
  for (const table of tables) {
    const names = tableIdToNames.get(table.id) ?? []
    for (const name of names) {
      const key = `${table.id}:${name.toLowerCase()}`
      if (!seen.has(key)) {
        toInsert.push({
          org_id: orgId,
          table_id: table.id,
          name,
        })
        seen.add(key)
      }
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await admin.from('table_services').insert(toInsert)
    if (insertError) {
      throw insertError
    }
  }

  const { data: services, error: servicesError } = await admin
    .from('table_services')
    .select('*')
    .in('table_id', tableIds.length > 0 ? tableIds : ['00000000-0000-0000-0000-000000000000'])

  if (servicesError || !services) {
    throw servicesError ?? new Error('Failed to fetch services')
  }

  return services
}

const seedLeadsIfEmpty = async (orgId, tables, salesUsers, adminUserId) => {
  const tableIds = tables.map((table) => table.id)
  const { data: existing, error: existingError } = await admin
    .from('leads')
    .select('id, table_id')
    .in('table_id', tableIds.length > 0 ? tableIds : ['00000000-0000-0000-0000-000000000000'])

  if (existingError) {
    throw existingError
  }

  const existingCountByTable = new Map()
  ;(existing ?? []).forEach((row) => {
    existingCountByTable.set(row.table_id, (existingCountByTable.get(row.table_id) ?? 0) + 1)
  })

  const leadsToInsert = []
  for (const table of tables) {
    const existingCount = existingCountByTable.get(table.id) ?? 0
    if (existingCount > 0) continue

    for (let i = 0; i < 12; i += 1) {
      const stage = STAGES[i % STAGES.length]
      const requiresFollowup = stage === 'Contacted'
      const owner = salesUsers[i % salesUsers.length]
      const slug = table.name.toLowerCase().replace(/\s+/g, '')
      const leadNumber = i + 1

      leadsToInsert.push({
        org_id: orgId,
        table_id: table.id,
        business_name: `${table.name} Lead ${leadNumber}`,
        stage,
        owner_id: owner?.user_id ?? null,
        next_followup_at: requiresFollowup
          ? new Date(Date.now() + 86400000 * ((i % 7) + 1)).toISOString().slice(0, 10)
          : null,
        followup_window: ['Morning', 'Afternoon', 'Anytime'][i % 3],
        contact: requiresFollowup ? `lead${leadNumber}@example.com` : null,
        website_url: `https://lead${leadNumber}.${slug}.example.com`,
        notes: `Seed lead ${leadNumber}`,
        source_type: SOURCES[i % SOURCES.length],
        source_detail: 'Seed import',
        do_not_contact: i % 11 === 0,
        is_archived: false,
        created_by: adminUserId,
        updated_by: adminUserId,
      })
    }
  }

  if (leadsToInsert.length === 0) {
    return []
  }

  const { data: insertedLeads, error: leadError } = await admin
    .from('leads')
    .insert(leadsToInsert)
    .select('id, table_id')

  if (leadError || !insertedLeads) {
    throw leadError ?? new Error('Failed to create leads')
  }

  return insertedLeads
}

const main = async () => {
  const org = await ensureOrg()

  const ensuredUsers = []
  for (const userSeed of USERS) {
    const ensured = await ensureUser({
      email: userSeed.email,
      displayName: userSeed.display_name,
      password: userSeed.password,
    })

    ensuredUsers.push({
      ...userSeed,
      user_id: ensured.user.id,
      created: ensured.created,
      password_set: ensured.passwordSet,
    })
  }

  const profileRows = ensuredUsers.map((user) => ({
    user_id: user.user_id,
    org_id: org.id,
    display_name: user.display_name,
    role: user.role,
    theme_preference: 'system',
    is_disabled: false,
  }))

  const { error: profileError } = await admin
    .from('profiles')
    .upsert(profileRows, { onConflict: 'user_id' })
  if (profileError) {
    throw profileError
  }

  const adminUser = ensuredUsers.find((user) => user.role === 'admin')
  const salesUsers = ensuredUsers.filter((user) => user.role === 'sales')

  const tableRows = TABLES.map((name) => ({
    org_id: org.id,
    name,
    default_stage: 'New',
    default_source_type: 'Unknown',
    created_by: adminUser.user_id,
  }))

  const { data: tables, error: tableError } = await admin
    .from('lead_tables')
    .upsert(tableRows, { onConflict: 'org_id,name' })
    .select('*')

  if (tableError || !tables) {
    throw tableError ?? new Error('Failed to create tables')
  }

  const permissionRows = []
  for (const table of tables) {
    for (const salesUser of salesUsers) {
      permissionRows.push({
        org_id: org.id,
        table_id: table.id,
        user_id: salesUser.user_id,
        access_level: Math.random() > 0.3 ? 'edit' : 'read',
      })
    }
  }

  const { error: permissionError } = await admin
    .from('table_permissions')
    .upsert(permissionRows, { onConflict: 'table_id,user_id' })

  if (permissionError) {
    throw permissionError
  }

  const services = await ensureServices(org.id, tables)
  const insertedLeads = await seedLeadsIfEmpty(
    org.id,
    tables,
    salesUsers,
    adminUser.user_id,
  )

  if (insertedLeads.length > 0) {
    const servicesByTable = new Map()
    for (const service of services) {
      const bucket = servicesByTable.get(service.table_id) ?? []
      bucket.push(service)
      servicesByTable.set(service.table_id, bucket)
    }

    const leadServiceRows = []
    for (const lead of insertedLeads) {
      const tableServices = servicesByTable.get(lead.table_id) ?? []
      const sampleSize = Math.min(2, tableServices.length)
      const sample = tableServices.slice(0, Math.max(1, sampleSize))
      for (const service of sample) {
        leadServiceRows.push({
          lead_id: lead.id,
          service_id: service.id,
        })
      }
    }

    if (leadServiceRows.length > 0) {
      const { error: leadServicesError } = await admin
        .from('lead_services')
        .upsert(leadServiceRows, {
          onConflict: 'lead_id,service_id',
          ignoreDuplicates: true,
        })

      if (leadServicesError) {
        throw leadServicesError
      }
    }
  }

  const adminSeedUser = ensuredUsers.find((user) => user.role === 'admin')
  const adminPasswordStatus = adminSeedUser.password_set
    ? 'set or reset by seed'
    : 'unchanged (user already existed)'

  console.log(
    JSON.stringify(
      {
        org_id: org.id,
        org_name: org.name,
        admin_email: adminSeedUser.email,
        admin_password_status: adminPasswordStatus,
        users: ensuredUsers.map((user) => ({
          email: user.email,
          user_id: user.user_id,
          role: user.role,
          created: user.created,
        })),
        table_count: tables.length,
        lead_count_created_this_run: insertedLeads.length,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
