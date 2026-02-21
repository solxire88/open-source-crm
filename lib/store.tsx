"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import type {
  AccessLevel,
  Attachment,
  Lead,
  LeadEvent,
  Org,
  SalesTable,
  Service,
  TablePermission,
  User,
} from "./types"
import { apiFetch, ApiClientError } from "@/lib/api/client"
import {
  toAttachment,
  toLead,
  toLeadEvent,
  toOrg,
  toSalesTable,
  toService,
  toTablePermission,
  toUser,
} from "@/lib/api/adapters"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

const PAGE_SIZE = 200
const LEAD_PATCH_DEBOUNCE_MS = 600

const EMPTY_USER: User = {
  id: "",
  name: "",
  email: "",
  role: "sales",
}

const EMPTY_ORG: Org = {
  id: "",
  name: "",
  logoUrl: null,
}

interface BulkActionInput {
  lead_ids: string[]
  action:
    | "assign_owner"
    | "change_stage"
    | "set_source"
    | "set_followup"
    | "add_services"
    | "remove_services"
    | "archive"
  payload?: Record<string, unknown>
}

interface LoadTableWorkspaceOptions {
  force?: boolean
  view?: "new" | "my" | "due" | "pipeline" | "all"
  includeArchived?: boolean
  includeDnc?: boolean
}

interface StoreContextValue {
  // Auth
  isAuthenticated: boolean
  isBootstrapping: boolean
  loginWithPassword: (email: string, password: string) => Promise<void>
  loginWithMagicLink: (email: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  currentUser: User
  allUsers: User[]
  // Org
  org: Org
  updateLogo: (file: File | null) => Promise<void>
  // Tables
  tables: SalesTable[]
  addTable: (t: SalesTable) => Promise<void>
  updateTable: (id: string, updates: Partial<SalesTable>) => Promise<void>
  deleteTable: (id: string) => Promise<void>
  loadTableWorkspace: (tableId: string, options?: LoadTableWorkspaceOptions) => Promise<void>
  // Permissions
  permissions: TablePermission[]
  updatePermission: (tableId: string, userId: string, access: AccessLevel | null) => Promise<void>
  getAccess: (tableId: string) => AccessLevel | null
  getPermittedTables: () => SalesTable[]
  // Leads
  leads: Lead[]
  updateLead: (id: string, updates: Partial<Lead>) => void
  saveLead: (id: string, updates: Partial<Lead>) => Promise<void>
  addLead: (lead: Lead) => Promise<void>
  claimLead: (leadId: string, ownerId?: string) => Promise<void>
  logTouchLead: (leadId: string, note?: string) => Promise<void>
  archiveLead: (leadId: string) => Promise<void>
  restoreLead: (leadId: string) => Promise<void>
  runBulkAction: (tableId: string, payload: BulkActionInput) => Promise<void>
  // Services
  services: Service[]
  addService: (s: Service) => Promise<void>
  updateService: (id: string, updates: Partial<Service>) => Promise<void>
  deleteService: (id: string) => Promise<void>
  // Favorites
  favorites: string[]
  toggleFavorite: (tableId: string) => Promise<void>
  // Events
  events: LeadEvent[]
  addEvent: (e: LeadEvent) => void
  loadLeadArtifacts: (leadId: string) => Promise<void>
  // Attachments
  attachments: Attachment[]
  uploadAttachment: (leadId: string, file: File) => Promise<void>
  // Users management
  users: User[]
  addUser: (
    u: User,
    options?: {
      invite?: boolean
      tempPassword?: string
    },
  ) => Promise<{ tempPassword: string | null }>
  updateUser: (id: string, updates: Partial<User>) => Promise<void>
  deleteUser: (id: string) => Promise<void>
}

const StoreContext = createContext<StoreContextValue | null>(null)

const toDateOnly = (value: string | null | undefined) => {
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString().slice(0, 10)
}

const canSetContactedStage = (lead: Partial<Lead>) => {
  if (lead.stage !== "Contacted") {
    return true
  }

  const hasContact = typeof lead.contact === "string" && lead.contact.trim().length > 0
  const hasFollowUp = toDateOnly(lead.nextFollowUpAt ?? null) !== null

  return hasContact && hasFollowUp
}

const createLeadPayload = (lead: Lead) => ({
  business_name: lead.businessName,
  stage: lead.stage,
  owner_id: lead.ownerId,
  next_followup_at: toDateOnly(lead.nextFollowUpAt),
  followup_window: lead.followUpWindow,
  contact: lead.contact || null,
  website_url: lead.websiteUrl || null,
  notes: lead.notes || null,
  source_type: lead.sourceType,
  source_detail: lead.sourceDetail || null,
  do_not_contact: lead.doNotContact,
  dnc_reason: lead.dncReason || null,
  lost_reason: lead.lostReason || null,
  is_archived: lead.isArchived,
  service_ids: lead.interestedServices,
})

const createLeadPatchPayload = (updates: Partial<Lead>) => {
  const payload: Record<string, unknown> = {}

  if ("businessName" in updates) payload.business_name = updates.businessName
  if ("stage" in updates) payload.stage = updates.stage
  if ("ownerId" in updates) payload.owner_id = updates.ownerId ?? null
  if ("nextFollowUpAt" in updates) payload.next_followup_at = toDateOnly(updates.nextFollowUpAt ?? null)
  if ("followUpWindow" in updates) payload.followup_window = updates.followUpWindow
  if ("contact" in updates) {
    const normalizedContact =
      typeof updates.contact === "string" ? updates.contact.trim() : ""
    if (normalizedContact.length > 0) {
      payload.contact = normalizedContact
    } else {
      payload.contact = null
    }
  }
  if ("websiteUrl" in updates) payload.website_url = updates.websiteUrl ?? null
  if ("notes" in updates) payload.notes = updates.notes ?? null
  if ("sourceType" in updates) payload.source_type = updates.sourceType
  if ("sourceDetail" in updates) payload.source_detail = updates.sourceDetail ?? null
  if ("doNotContact" in updates) payload.do_not_contact = updates.doNotContact
  if ("dncReason" in updates) payload.dnc_reason = updates.dncReason ?? null
  if ("lostReason" in updates) payload.lost_reason = updates.lostReason ?? null
  if ("isArchived" in updates) payload.is_archived = updates.isArchived
  if ("interestedServices" in updates) payload.service_ids = updates.interestedServices ?? []

  return payload
}

const fetchAllPages = async <T,>(
  buildUrl: (offset: number, limit: number) => string,
): Promise<T[]> => {
  let offset = 0
  let total = Infinity
  const items: T[] = []

  while (offset < total) {
    const response = await apiFetch<{
      items: T[]
      pagination: { limit: number; offset: number; total: number }
    }>(buildUrl(offset, PAGE_SIZE))

    items.push(...(response.items ?? []))
    total = response.pagination.total
    offset += response.pagination.limit

    if ((response.items ?? []).length === 0) {
      break
    }
  }

  return items
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const refreshRunIdRef = useRef(0)
  const hasBootstrappedRef = useRef(false)

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [currentUser, setCurrentUser] = useState<User>(EMPTY_USER)
  const [users, setUsers] = useState<User[]>([])
  const [org, setOrg] = useState<Org>(EMPTY_ORG)
  const [tables, setTables] = useState<SalesTable[]>([])
  const [permissions, setPermissions] = useState<TablePermission[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [events, setEvents] = useState<LeadEvent[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const leadPatchQueueRef = useRef<Map<string, Partial<Lead>>>(new Map())
  const leadPatchTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const tableWorkspaceLoadedRef = useRef<Set<string>>(new Set())
  const tableWorkspaceLoadingRef = useRef<Map<string, Promise<void>>>(new Map())
  const tableWorkspacePayloadRef = useRef<
    Map<
      string,
      {
        leads: Lead[]
        services: Service[]
      }
    >
  >(new Map())
  const tableServicesLoadedRef = useRef<Set<string>>(new Set())

  const getWorkspaceKey = useCallback(
    (tableId: string, options: Required<Pick<LoadTableWorkspaceOptions, "view" | "includeArchived" | "includeDnc">>) =>
      `${tableId}::${options.view}::arch=${options.includeArchived ? "1" : "0"}::dnc=${options.includeDnc ? "1" : "0"}`,
    [],
  )

  const getWorkspaceOptions = useCallback(
    (options?: LoadTableWorkspaceOptions) => {
      const view = options?.view ?? "all"

      const includeArchived =
        options?.includeArchived ??
        (view === "all" ? true : false)

      const includeDnc =
        options?.includeDnc ??
        (view === "all" || view === "pipeline")

      return {
        view,
        includeArchived,
        includeDnc,
      } as const
    },
    [],
  )

  const workspaceKeyBelongsToTable = useCallback((workspaceKey: string, tableId: string) => {
    return workspaceKey.startsWith(`${tableId}::`)
  }, [])

  const invalidateTableWorkspaceCache = useCallback(
    (tableId: string, options?: { invalidateServices?: boolean }) => {
      tableWorkspaceLoadedRef.current.forEach((workspaceKey) => {
        if (workspaceKeyBelongsToTable(workspaceKey, tableId)) {
          tableWorkspaceLoadedRef.current.delete(workspaceKey)
        }
      })

      tableWorkspaceLoadingRef.current.forEach((_promise, workspaceKey) => {
        if (workspaceKeyBelongsToTable(workspaceKey, tableId)) {
          tableWorkspaceLoadingRef.current.delete(workspaceKey)
        }
      })

      tableWorkspacePayloadRef.current.forEach((_payload, workspaceKey) => {
        if (workspaceKeyBelongsToTable(workspaceKey, tableId)) {
          tableWorkspacePayloadRef.current.delete(workspaceKey)
        }
      })

      if (options?.invalidateServices) {
        tableServicesLoadedRef.current.delete(tableId)
      }
    },
    [workspaceKeyBelongsToTable],
  )

  const resetState = useCallback(() => {
    refreshRunIdRef.current += 1

    leadPatchTimersRef.current.forEach((timer) => clearTimeout(timer))
    leadPatchTimersRef.current.clear()
    leadPatchQueueRef.current.clear()
    tableWorkspaceLoadedRef.current.clear()
    tableWorkspaceLoadingRef.current.clear()
    tableWorkspacePayloadRef.current.clear()
    tableServicesLoadedRef.current.clear()

    setIsAuthenticated(false)
    setCurrentUser(EMPTY_USER)
    setUsers([])
    setOrg(EMPTY_ORG)
    setTables([])
    setPermissions([])
    setLeads([])
    setServices([])
    setFavorites([])
    setEvents([])
    setAttachments([])
    setIsBootstrapping(false)
  }, [])

  const fetchTableServices = useCallback(async (tableId: string) => {
    const rows = await fetchAllPages<{
      id: string
      table_id: string
      name: string
      is_archived: boolean
    }>((offset, limit) => `/api/tables/${tableId}/services?limit=${limit}&offset=${offset}`)

    return rows.map(toService)
  }, [])

  const fetchTableLeads = useCallback(async (
    tableId: string,
    options: Required<Pick<LoadTableWorkspaceOptions, "view" | "includeArchived" | "includeDnc">>,
  ) => {
    const params = new URLSearchParams()
    params.set("view", options.view)
    params.set("includeArchived", options.includeArchived ? "1" : "0")
    params.set("includeDnc", options.includeDnc ? "1" : "0")

    const rows = await fetchAllPages<{
      id: string
      table_id: string
      business_name: string
      stage: Lead["stage"]
      owner_id: string | null
      next_followup_at: string | null
      followup_window: Lead["followUpWindow"]
      contact: string | null
      website_url: string | null
      notes: string | null
      source_type: Lead["sourceType"]
      source_detail: string | null
      last_touched_at: string | null
      do_not_contact: boolean
      dnc_reason: string | null
      lost_reason: string | null
      is_archived: boolean
      stage_changed_at: string
      created_at: string
      lead_services?: Array<{ service_id: string }>
    }>((offset, limit) => {
      params.set("limit", String(limit))
      params.set("offset", String(offset))
      return `/api/tables/${tableId}/leads?${params.toString()}`
    })

    return rows.map((row) => toLead(row))
  }, [])

  const fetchTablePermissions = useCallback(async (tableId: string) => {
    const rows = await fetchAllPages<{
      user_id: string
      access_level: "read" | "edit"
    }>((offset, limit) => `/api/tables/${tableId}/permissions?limit=${limit}&offset=${offset}`)

    return rows.map((entry) =>
      toTablePermission({
        table_id: tableId,
        user_id: entry.user_id,
        access_level: entry.access_level,
      }),
    )
  }, [])

  const fetchOrgPermissions = useCallback(async () => {
    const rows = await fetchAllPages<{
      table_id: string
      user_id: string
      access_level: "read" | "edit"
    }>((offset, limit) => `/api/permissions?limit=${limit}&offset=${offset}`)

    return rows.map(toTablePermission)
  }, [])

  const refresh = useCallback(async () => {
    const runId = refreshRunIdRef.current + 1
    refreshRunIdRef.current = runId
    if (!hasBootstrappedRef.current) {
      setIsBootstrapping(true)
    }

    try {
      const [meResponse, tablesResponse] = await Promise.all([
        apiFetch<{
          user: { id: string; email?: string | null }
          profile: { user_id: string; display_name: string; role: "admin" | "sales" }
          organization: { id: string; name: string; logo_url?: string | null; logo_signed_url?: string | null }
        }>("/api/me"),
        fetchAllPages<{
          id: string
          name: string
          is_archived: boolean
          default_stage: Lead["stage"]
          default_source_type: Lead["sourceType"] | null
          default_source_detail: string | null
          access_level: "read" | "edit"
        }>((offset, limit) => `/api/tables?includeArchived=1&limit=${limit}&offset=${offset}`),
      ])

      const meUser = toUser(
        {
          user_id: meResponse.profile.user_id,
          display_name: meResponse.profile.display_name,
          role: meResponse.profile.role,
        },
        meResponse.user.email,
      )
      const mappedTables = tablesResponse.map(toSalesTable)
      const allowedTableIds = new Set(mappedTables.map((table) => table.id))

      if (runId !== refreshRunIdRef.current) {
        return
      }

      setCurrentUser(meUser)
      setOrg(toOrg(meResponse.organization))
      setIsAuthenticated(true)
      setTables(mappedTables)
      setUsers([meUser])

      if (meUser.role === "admin") {
        setPermissions([])
      } else {
        setPermissions(
          tablesResponse.map((table) =>
            toTablePermission({
              table_id: table.id,
              user_id: meUser.id,
              access_level: table.access_level ?? "read",
            }),
          ),
        )
      }

      setServices((prev) => prev.filter((service) => allowedTableIds.has(service.tableId)))
      setLeads((prev) => prev.filter((lead) => allowedTableIds.has(lead.tableId)))
      setFavorites((prev) => prev.filter((tableId) => allowedTableIds.has(tableId)))

      tableWorkspaceLoadedRef.current = new Set(
        [...tableWorkspaceLoadedRef.current].filter((workspaceKey) => {
          const [tableId] = workspaceKey.split("::")
          return allowedTableIds.has(tableId ?? "")
        }),
      )
      tableWorkspaceLoadingRef.current.forEach((_promise, workspaceKey) => {
        const [tableId] = workspaceKey.split("::")
        if (!allowedTableIds.has(tableId ?? "")) {
          tableWorkspaceLoadingRef.current.delete(workspaceKey)
        }
      })
      tableWorkspacePayloadRef.current.forEach((_payload, workspaceKey) => {
        const [tableId] = workspaceKey.split("::")
        if (!allowedTableIds.has(tableId ?? "")) {
          tableWorkspacePayloadRef.current.delete(workspaceKey)
        }
      })
      tableServicesLoadedRef.current.forEach((tableId) => {
        if (!allowedTableIds.has(tableId)) {
          tableServicesLoadedRef.current.delete(tableId)
        }
      })

      void Promise.allSettled([
        fetchAllPages<{
          user_id: string
          display_name: string
          role: "admin" | "sales"
          is_disabled: boolean
        }>((offset, limit) => `/api/users?limit=${limit}&offset=${offset}`),
        apiFetch<{ table_ids: string[] }>("/api/favorites/tables"),
        meUser.role === "admin" ? fetchOrgPermissions() : Promise.resolve(null),
      ]).then((results) => {
        if (runId !== refreshRunIdRef.current) {
          return
        }

        const [usersResult, favoritesResult, permissionsResult] = results

        if (usersResult.status === "fulfilled") {
          const mappedUsers = usersResult.value.map((user) => toUser(user))
          const hasCurrent = mappedUsers.some((user) => user.id === meUser.id)
          const mergedUsers = hasCurrent ? mappedUsers : [meUser, ...mappedUsers]
          setUsers(mergedUsers)
        } else {
          console.error(usersResult.reason)
          setUsers([meUser])
        }

        if (favoritesResult.status === "fulfilled") {
          const visibleFavoriteIds = (favoritesResult.value.table_ids ?? []).filter((tableId) =>
            allowedTableIds.has(tableId),
          )
          setFavorites(visibleFavoriteIds)
        } else {
          console.error(favoritesResult.reason)
          setFavorites([])
        }

        if (meUser.role === "admin") {
          if (permissionsResult.status === "fulfilled") {
            setPermissions(permissionsResult.value ?? [])
          } else {
            console.error(permissionsResult.reason)
          }
        }
      })
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        resetState()
      } else {
        console.error(error)
      }
    } finally {
      if (runId === refreshRunIdRef.current) {
        hasBootstrappedRef.current = true
        setIsBootstrapping(false)
      }
    }
  }, [fetchOrgPermissions, resetState])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        void refresh()
      }
    })

    void refresh()

    return () => {
      subscription.unsubscribe()
      leadPatchTimersRef.current.forEach((timer) => clearTimeout(timer))
    }
  }, [refresh])

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw new Error(error.message)
      }

      await refresh()
    },
    [refresh],
  )

  const loginWithMagicLink = useCallback(async (email: string) => {
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    })

    if (error) {
      throw new Error(error.message)
    }
  }, [])

  const logout = useCallback(async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    resetState()
  }, [resetState])

  const getAccess = useCallback(
    (tableId: string): AccessLevel | null => {
      if (!tables.some((table) => table.id === tableId)) {
        return null
      }

      if (currentUser.role === "admin") {
        return "edit"
      }

      const permission = permissions.find(
        (entry) => entry.tableId === tableId && entry.userId === currentUser.id,
      )

      return permission?.access ?? "read"
    },
    [currentUser.id, currentUser.role, permissions, tables],
  )

  const getPermittedTables = useCallback(() => {
    if (currentUser.role === "admin") {
      return tables.filter((table) => !table.isArchived)
    }

    return tables.filter((table) => !table.isArchived && getAccess(table.id) !== null)
  }, [currentUser.role, getAccess, tables])

  const loadTableWorkspace = useCallback(
    async (tableId: string, options?: LoadTableWorkspaceOptions) => {
      const force = options?.force ?? false
      const workspaceOptions = getWorkspaceOptions(options)
      const workspaceKey = getWorkspaceKey(tableId, workspaceOptions)

      if (force) {
        invalidateTableWorkspaceCache(tableId)
      }

      const cachedPayload = tableWorkspacePayloadRef.current.get(workspaceKey)
      if (!force && cachedPayload) {
        setServices((prev) => [
          ...prev.filter((service) => service.tableId !== tableId),
          ...cachedPayload.services,
        ])
        setLeads((prev) => [
          ...prev.filter((lead) => lead.tableId !== tableId),
          ...cachedPayload.leads,
        ])
        tableWorkspaceLoadedRef.current.add(workspaceKey)
        return
      }

      if (tableWorkspaceLoadedRef.current.has(workspaceKey)) {
        return
      }

      const inFlight = tableWorkspaceLoadingRef.current.get(workspaceKey)
      if (inFlight) {
        await inFlight
        return
      }

      const request = (async () => {
        const shouldFetchServices = !tableServicesLoadedRef.current.has(tableId)

        const [fetchedServices, tableLeads] = await Promise.all([
          shouldFetchServices ? fetchTableServices(tableId) : Promise.resolve<Service[] | null>(null),
          fetchTableLeads(tableId, workspaceOptions),
        ])

        const cachedServices = (() => {
          for (const [cachedWorkspaceKey, payload] of tableWorkspacePayloadRef.current.entries()) {
            if (workspaceKeyBelongsToTable(cachedWorkspaceKey, tableId) && payload.services.length > 0) {
              return payload.services
            }
          }
          return [] as Service[]
        })()

        const tableServices = fetchedServices ?? cachedServices

        if (fetchedServices) {
          tableServicesLoadedRef.current.add(tableId)
          setServices((prev) => [
            ...prev.filter((service) => service.tableId !== tableId),
            ...fetchedServices,
          ])
        }

        tableWorkspacePayloadRef.current.set(workspaceKey, {
          leads: tableLeads,
          services: tableServices,
        })
        setLeads((prev) => [...prev.filter((lead) => lead.tableId !== tableId), ...tableLeads])
        tableWorkspaceLoadedRef.current.add(workspaceKey)
      })()

      tableWorkspaceLoadingRef.current.set(workspaceKey, request)

      try {
        await request
      } finally {
        tableWorkspaceLoadingRef.current.delete(workspaceKey)
      }
    },
    [
      fetchTableLeads,
      fetchTableServices,
      getWorkspaceKey,
      getWorkspaceOptions,
      invalidateTableWorkspaceCache,
      workspaceKeyBelongsToTable,
    ],
  )

  const addTable = useCallback(
    async (table: SalesTable) => {
      const response = await apiFetch<{
        item: {
          id: string
          name: string
          is_archived: boolean
          default_stage: Lead["stage"]
          default_source_type: Lead["sourceType"] | null
          default_source_detail: string | null
        }
      }>("/api/tables", {
        method: "POST",
        body: JSON.stringify({
          name: table.name,
          default_stage: table.defaults.defaultStage,
          default_source_type: table.defaults.defaultSourceType,
          default_source_detail: table.defaults.defaultSourceDetail ?? null,
        }),
      })

      const mapped = toSalesTable(response.item)
      setTables((prev) => [mapped, ...prev])
    },
    [],
  )

  const updateTable = useCallback(async (id: string, updates: Partial<SalesTable>) => {
    const payload: Record<string, unknown> = {}

    if ("name" in updates) payload.name = updates.name
    if ("isArchived" in updates) payload.is_archived = updates.isArchived
    if ("defaults" in updates && updates.defaults) {
      payload.default_stage = updates.defaults.defaultStage
      payload.default_source_type = updates.defaults.defaultSourceType
      payload.default_source_detail = updates.defaults.defaultSourceDetail ?? null
    }

    const response = await apiFetch<{
      item: {
        id: string
        name: string
        is_archived: boolean
        default_stage: Lead["stage"]
        default_source_type: Lead["sourceType"] | null
        default_source_detail: string | null
      }
    }>(`/api/tables/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })

    const mapped = toSalesTable(response.item)
    setTables((prev) => prev.map((table) => (table.id === id ? mapped : table)))
  }, [])

  const deleteTable = useCallback(async (id: string) => {
    await apiFetch(`/api/tables/${id}`, {
      method: "DELETE",
    })

    const removedLeadIds = new Set(
      leads.filter((lead) => lead.tableId === id).map((lead) => lead.id),
    )

    invalidateTableWorkspaceCache(id, { invalidateServices: true })
    tableServicesLoadedRef.current.delete(id)

    setTables((prev) => prev.filter((table) => table.id !== id))
    setPermissions((prev) => prev.filter((entry) => entry.tableId !== id))
    setServices((prev) => prev.filter((service) => service.tableId !== id))
    setLeads((prev) => prev.filter((lead) => lead.tableId !== id))
    setFavorites((prev) => prev.filter((tableId) => tableId !== id))

    if (removedLeadIds.size > 0) {
      setEvents((prev) => prev.filter((event) => !removedLeadIds.has(event.leadId)))
      setAttachments((prev) =>
        prev.filter((attachment) => !removedLeadIds.has(attachment.leadId)),
      )
    }
  }, [invalidateTableWorkspaceCache, leads])

  const updatePermission = useCallback(
    async (tableId: string, userId: string, access: AccessLevel | null) => {
      let tablePermissions = permissions.filter((entry) => entry.tableId === tableId)

      if (tablePermissions.length === 0) {
        tablePermissions = await fetchTablePermissions(tableId)
        setPermissions((prev) => [
          ...prev.filter((entry) => entry.tableId !== tableId),
          ...tablePermissions,
        ])
      }

      const nextTablePermissions = (() => {
        const filtered = tablePermissions.filter((entry) => entry.userId !== userId)
        if (access === null) return filtered
        return [...filtered, { tableId, userId, access }]
      })()

      setPermissions((prev) => [
        ...prev.filter((entry) => entry.tableId !== tableId),
        ...nextTablePermissions,
      ])

      const payload = nextTablePermissions
        .map((entry) => ({
          user_id: entry.userId,
          access_level: entry.access,
        }))

      try {
        const response = await apiFetch<{
          items: Array<{ user_id: string; access_level: "read" | "edit" }>
        }>(`/api/tables/${tableId}/permissions`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })

        setPermissions((prev) => [
          ...prev.filter((entry) => entry.tableId !== tableId),
          ...response.items.map((entry) =>
            toTablePermission({
              table_id: tableId,
              user_id: entry.user_id,
              access_level: entry.access_level,
            }),
          ),
        ])
      } catch (error) {
        try {
          const reloadedPermissions = await fetchTablePermissions(tableId)
          setPermissions((prev) => [
            ...prev.filter((entry) => entry.tableId !== tableId),
            ...reloadedPermissions,
          ])
        } catch (reloadError) {
          console.error(reloadError)
        }
        throw error
      }
    },
    [fetchTablePermissions, permissions],
  )

  const flushLeadUpdate = useCallback(async (leadId: string) => {
    const pendingUpdates = leadPatchQueueRef.current.get(leadId)
    leadPatchQueueRef.current.delete(leadId)
    leadPatchTimersRef.current.delete(leadId)

    if (!pendingUpdates) {
      return
    }

    const payload = createLeadPatchPayload(pendingUpdates)
    if (Object.keys(payload).length === 0) {
      return
    }

    try {
      const response = await apiFetch<{
        item: {
          id: string
          table_id: string
          business_name: string
          stage: Lead["stage"]
          owner_id: string | null
          next_followup_at: string | null
          followup_window: Lead["followUpWindow"]
          contact: string | null
          website_url: string | null
          notes: string | null
          source_type: Lead["sourceType"]
          source_detail: string | null
          last_touched_at: string | null
          do_not_contact: boolean
          dnc_reason: string | null
          lost_reason: string | null
          is_archived: boolean
          stage_changed_at: string
          created_at: string
          lead_services?: Array<{ service_id: string }>
        }
      }>(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })

      const serviceIds =
        "interestedServices" in pendingUpdates
          ? pendingUpdates.interestedServices
          : undefined

      setLeads((prev) =>
        prev.map((lead) => {
          if (lead.id !== leadId) {
            return lead
          }

          const responseServiceIds = response.item.lead_services?.map(
            (service) => service.service_id,
          )

          const resolvedServiceIds =
            serviceIds ?? responseServiceIds ?? lead.interestedServices

          return toLead(response.item, resolvedServiceIds)
        }),
      )
      invalidateTableWorkspaceCache(response.item.table_id)
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.message)
      } else {
        console.error(error)
        toast.error("Failed to update lead")
      }
      try {
        const reloaded = await apiFetch<{
          item: {
            id: string
            table_id: string
            business_name: string
            stage: Lead["stage"]
            owner_id: string | null
            next_followup_at: string | null
            followup_window: Lead["followUpWindow"]
            contact: string | null
            website_url: string | null
            notes: string | null
            source_type: Lead["sourceType"]
            source_detail: string | null
            last_touched_at: string | null
            do_not_contact: boolean
            dnc_reason: string | null
            lost_reason: string | null
            is_archived: boolean
            stage_changed_at: string
            created_at: string
          }
          services: Array<{ service_id: string }>
        }>(`/api/leads/${leadId}`)

        setLeads((prev) =>
          prev.map((lead) =>
            lead.id === leadId
              ? toLead(
                  {
                    ...reloaded.item,
                    lead_services: reloaded.services,
                  },
                  reloaded.services.map((service) => service.service_id),
                )
              : lead,
          ),
        )
      } catch (reloadError) {
        console.error(reloadError)
      }
    }
  }, [invalidateTableWorkspaceCache])

  const updateLead = useCallback(
    (id: string, updates: Partial<Lead>) => {
      const preparedUpdates: Partial<Lead> = { ...updates }
      const outcome = {
        current: "missing" as "applied" | "blocked_contacted" | "missing",
      }
      setLeads((prev) =>
        prev.map((lead) => {
          if (lead.id !== id) {
            return lead
          }

          const nextLead = { ...lead, ...updates }
          if (!canSetContactedStage(nextLead)) {
            outcome.current = "blocked_contacted"
            return lead
          }

          if (preparedUpdates.stage !== undefined && preparedUpdates.contact === undefined) {
            preparedUpdates.contact = nextLead.contact
          }

          if (nextLead.stage === "Contacted") {
            if (preparedUpdates.contact === undefined) {
              preparedUpdates.contact = nextLead.contact
            }
            if (preparedUpdates.nextFollowUpAt === undefined) {
              preparedUpdates.nextFollowUpAt = nextLead.nextFollowUpAt
            }
          }

          outcome.current = "applied"
          return nextLead
        }),
      )

      if (outcome.current !== "applied") {
        if (outcome.current === "blocked_contacted") {
          toast.error("Contact and next follow-up are required before setting stage to Contacted")
        }
        return
      }

      const existing = leadPatchQueueRef.current.get(id) ?? {}
      leadPatchQueueRef.current.set(id, { ...existing, ...preparedUpdates })

      const previousTimer = leadPatchTimersRef.current.get(id)
      if (previousTimer) {
        clearTimeout(previousTimer)
      }

      const timer = setTimeout(() => {
        void flushLeadUpdate(id)
      }, LEAD_PATCH_DEBOUNCE_MS)
      leadPatchTimersRef.current.set(id, timer)
    },
    [flushLeadUpdate],
  )

  const saveLead = useCallback(async (id: string, updates: Partial<Lead>) => {
    const timer = leadPatchTimersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      leadPatchTimersRef.current.delete(id)
    }
    leadPatchQueueRef.current.delete(id)

    const preparedUpdates: Partial<Lead> = { ...updates }
    const currentLead = leads.find((lead) => lead.id === id)

    if (preparedUpdates.stage !== undefined && preparedUpdates.contact === undefined) {
      preparedUpdates.contact = currentLead?.contact ?? ""
    }

    if (preparedUpdates.stage === "Contacted") {
      const nextContact =
        preparedUpdates.contact !== undefined ? preparedUpdates.contact : currentLead?.contact ?? ""
      const nextFollowUp =
        preparedUpdates.nextFollowUpAt !== undefined
          ? preparedUpdates.nextFollowUpAt
          : currentLead?.nextFollowUpAt ?? null

      if (!nextContact.trim() || !toDateOnly(nextFollowUp)) {
        throw new Error("Contact and next follow-up are required when stage is Contacted")
      }

      if (preparedUpdates.contact === undefined) {
        preparedUpdates.contact = nextContact
      }
      if (preparedUpdates.nextFollowUpAt === undefined) {
        preparedUpdates.nextFollowUpAt = nextFollowUp
      }
    }

    const payload = createLeadPatchPayload(preparedUpdates)
    if (Object.keys(payload).length === 0) {
      return
    }

    const response = await apiFetch<{
      item: {
        id: string
        table_id: string
        business_name: string
        stage: Lead["stage"]
        owner_id: string | null
        next_followup_at: string | null
        followup_window: Lead["followUpWindow"]
        contact: string | null
        website_url: string | null
        notes: string | null
        source_type: Lead["sourceType"]
        source_detail: string | null
        last_touched_at: string | null
        do_not_contact: boolean
        dnc_reason: string | null
        lost_reason: string | null
        is_archived: boolean
        stage_changed_at: string
        created_at: string
        lead_services?: Array<{ service_id: string }>
      }
    }>(`/api/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })

    const serviceIds =
      "interestedServices" in preparedUpdates ? preparedUpdates.interestedServices : undefined

    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id !== id) {
          return lead
        }

        const responseServiceIds = response.item.lead_services?.map(
          (service) => service.service_id,
        )

        const resolvedServiceIds =
          serviceIds ?? responseServiceIds ?? lead.interestedServices

        return toLead(response.item, resolvedServiceIds)
      }),
    )
    invalidateTableWorkspaceCache(response.item.table_id)
  }, [invalidateTableWorkspaceCache, leads])

  const addLead = useCallback(async (lead: Lead) => {
    const response = await apiFetch<{
      item: {
        id: string
        table_id: string
        business_name: string
        stage: Lead["stage"]
        owner_id: string | null
        next_followup_at: string | null
        followup_window: Lead["followUpWindow"]
        contact: string | null
        website_url: string | null
        notes: string | null
        source_type: Lead["sourceType"]
        source_detail: string | null
        last_touched_at: string | null
        do_not_contact: boolean
        dnc_reason: string | null
        lost_reason: string | null
        is_archived: boolean
        stage_changed_at: string
        created_at: string
      }
    }>(`/api/tables/${lead.tableId}/leads`, {
      method: "POST",
      body: JSON.stringify(createLeadPayload(lead)),
    })

    const mapped = toLead(response.item, lead.interestedServices)
    setLeads((prev) => [mapped, ...prev])
    invalidateTableWorkspaceCache(response.item.table_id)
  }, [invalidateTableWorkspaceCache])

  const claimLead = useCallback(async (leadId: string, ownerId?: string) => {
    const response = await apiFetch<{
      item: {
        id: string
        table_id: string
        business_name: string
        stage: Lead["stage"]
        owner_id: string | null
        next_followup_at: string | null
        followup_window: Lead["followUpWindow"]
        contact: string | null
        website_url: string | null
        notes: string | null
        source_type: Lead["sourceType"]
        source_detail: string | null
        last_touched_at: string | null
        do_not_contact: boolean
        dnc_reason: string | null
        lost_reason: string | null
        is_archived: boolean
        stage_changed_at: string
        created_at: string
      }
    }>(`/api/leads/${leadId}/claim`, {
      method: "POST",
      body: JSON.stringify(ownerId ? { owner_id: ownerId } : {}),
    })

    setLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? toLead(response.item, lead.interestedServices) : lead)),
    )
    invalidateTableWorkspaceCache(response.item.table_id)
  }, [invalidateTableWorkspaceCache])

  const logTouchLead = useCallback(
    async (leadId: string, note?: string) => {
      const response = await apiFetch<{
        item: {
          id: string
          table_id: string
          business_name: string
          stage: Lead["stage"]
          owner_id: string | null
          next_followup_at: string | null
          followup_window: Lead["followUpWindow"]
          contact: string | null
          website_url: string | null
          notes: string | null
          source_type: Lead["sourceType"]
          source_detail: string | null
          last_touched_at: string | null
          do_not_contact: boolean
          dnc_reason: string | null
          lost_reason: string | null
          is_archived: boolean
          stage_changed_at: string
          created_at: string
        }
      }>(`/api/leads/${leadId}/log-touch`, {
        method: "POST",
        body: JSON.stringify(note ? { note } : {}),
      })

      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? toLead(response.item, lead.interestedServices) : lead)),
      )
      invalidateTableWorkspaceCache(response.item.table_id)
    },
    [invalidateTableWorkspaceCache],
  )

  const archiveLead = useCallback(async (leadId: string) => {
    const response = await apiFetch<{
      item: {
        id: string
        table_id: string
        business_name: string
        stage: Lead["stage"]
        owner_id: string | null
        next_followup_at: string | null
        followup_window: Lead["followUpWindow"]
        contact: string | null
        website_url: string | null
        notes: string | null
        source_type: Lead["sourceType"]
        source_detail: string | null
        last_touched_at: string | null
        do_not_contact: boolean
        dnc_reason: string | null
        lost_reason: string | null
        is_archived: boolean
        stage_changed_at: string
        created_at: string
      }
    }>(`/api/leads/${leadId}/archive`, {
      method: "POST",
    })

    setLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? toLead(response.item, lead.interestedServices) : lead)),
    )
    invalidateTableWorkspaceCache(response.item.table_id)
  }, [invalidateTableWorkspaceCache])

  const restoreLead = useCallback(async (leadId: string) => {
    const response = await apiFetch<{
      item: {
        id: string
        table_id: string
        business_name: string
        stage: Lead["stage"]
        owner_id: string | null
        next_followup_at: string | null
        followup_window: Lead["followUpWindow"]
        contact: string | null
        website_url: string | null
        notes: string | null
        source_type: Lead["sourceType"]
        source_detail: string | null
        last_touched_at: string | null
        do_not_contact: boolean
        dnc_reason: string | null
        lost_reason: string | null
        is_archived: boolean
        stage_changed_at: string
        created_at: string
      }
    }>(`/api/leads/${leadId}/restore`, {
      method: "POST",
    })

    setLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? toLead(response.item, lead.interestedServices) : lead)),
    )
    invalidateTableWorkspaceCache(response.item.table_id)
  }, [invalidateTableWorkspaceCache])

  const runBulkAction = useCallback(
    async (tableId: string, payload: BulkActionInput) => {
      await apiFetch(`/api/tables/${tableId}/leads/bulk`, {
        method: "POST",
        body: JSON.stringify(payload),
      })

      await loadTableWorkspace(tableId, { force: true })
    },
    [loadTableWorkspace],
  )

  const addService = useCallback(async (service: Service) => {
    const response = await apiFetch<{
      item: { id: string; table_id: string; name: string; is_archived: boolean }
    }>(`/api/tables/${service.tableId}/services`, {
      method: "POST",
      body: JSON.stringify({
        name: service.name,
      }),
    })

    const mapped = toService(response.item)
    setServices((prev) => [...prev, mapped])
    invalidateTableWorkspaceCache(service.tableId, { invalidateServices: true })
  }, [invalidateTableWorkspaceCache])

  const updateService = useCallback(
    async (id: string, updates: Partial<Service>) => {
      const service = services.find((entry) => entry.id === id)
      if (!service) return

      const response = await apiFetch<{
        item: { id: string; table_id: string; name: string; is_archived: boolean }
      }>(`/api/tables/${service.tableId}/services/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.isArchived !== undefined ? { is_archived: updates.isArchived } : {}),
        }),
      })

      const mapped = toService(response.item)
      setServices((prev) => prev.map((entry) => (entry.id === id ? mapped : entry)))
      invalidateTableWorkspaceCache(service.tableId, { invalidateServices: true })
    },
    [invalidateTableWorkspaceCache, services],
  )

  const deleteService = useCallback(async (id: string) => {
    const service = services.find((entry) => entry.id === id)
    if (!service) return

    await apiFetch(`/api/tables/${service.tableId}/services/${id}`, {
      method: "DELETE",
    })

    setServices((prev) => prev.filter((entry) => entry.id !== id))
    setLeads((prev) =>
      prev.map((lead) =>
        lead.interestedServices.includes(id)
          ? {
              ...lead,
              interestedServices: lead.interestedServices.filter((serviceId) => serviceId !== id),
            }
          : lead,
      ),
    )
    invalidateTableWorkspaceCache(service.tableId, { invalidateServices: true })
  }, [invalidateTableWorkspaceCache, services])

  const toggleFavorite = useCallback(
    async (tableId: string) => {
      const next = favorites.includes(tableId)
        ? favorites.filter((id) => id !== tableId)
        : [...favorites, tableId]

      setFavorites(next)

      try {
        const response = await apiFetch<{ table_ids: string[] }>("/api/favorites/tables", {
          method: "PUT",
          body: JSON.stringify({ table_ids: next }),
        })
        setFavorites(response.table_ids ?? [])
      } catch (error) {
        console.error(error)
        setFavorites(favorites)
      }
    },
    [favorites],
  )

  const addEvent = useCallback((event: LeadEvent) => {
    setEvents((prev) => [event, ...prev])
  }, [])

  const loadLeadArtifacts = useCallback(async (leadId: string) => {
    const [eventsResponse, attachmentsResponse] = await Promise.all([
      fetchAllPages<{
        id: string
        lead_id: string
        actor_user_id: string | null
        event_type: string
        meta: Record<string, string>
        created_at: string
      }>((offset, limit) => `/api/leads/${leadId}/events?limit=${limit}&offset=${offset}`),
      fetchAllPages<{
        id: string
        lead_id: string
        filename: string
        download_url: string | null
        uploaded_by: string
        created_at: string
      }>((offset, limit) => `/api/leads/${leadId}/attachments?limit=${limit}&offset=${offset}`),
    ])

    setEvents((prev) => [...prev.filter((event) => event.leadId !== leadId), ...eventsResponse.map(toLeadEvent)])
    setAttachments((prev) => [
      ...prev.filter((attachment) => attachment.leadId !== leadId),
      ...attachmentsResponse.map(toAttachment),
    ])
  }, [])

  const uploadAttachment = useCallback(
    async (leadId: string, file: File) => {
      const response = await apiFetch<{
        upload: { token: string; path: string }
      }>(`/api/leads/${leadId}/attachments`, {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      })

      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.storage
        .from("lead_attachments")
        .uploadToSignedUrl(response.upload.path, response.upload.token, file)

      if (error) {
        throw new Error(error.message)
      }

      await loadLeadArtifacts(leadId)
    },
    [loadLeadArtifacts],
  )

  const updateLogo = useCallback(async (file: File | null) => {
    if (!file) {
      const response = await apiFetch<{
        organization: { id: string; name: string; logo_url: string | null }
      }>("/api/admin/org/logo", {
        method: "DELETE",
      })

      setOrg(toOrg(response.organization))
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/admin/org/logo", {
      method: "POST",
      body: formData,
    })
    const payload = await response.json()

    if (!response.ok) {
      const message =
        payload?.error?.message && typeof payload.error.message === "string"
          ? payload.error.message
          : "Failed to upload logo"
      throw new Error(message)
    }

    setOrg(
      toOrg({
        ...(payload.organization ?? {}),
        logo_signed_url: payload.logo?.signed_url ?? null,
      }),
    )
  }, [])

  const addUser = useCallback(async (
    user: User,
    options?: {
      invite?: boolean
      tempPassword?: string
    },
  ) => {
    const invite = options?.invite ?? false
    const tempPassword = options?.tempPassword

    const response = await apiFetch<{
      item: {
        auth_user: { id: string; email?: string | null }
        profile: { user_id: string; display_name: string; role: "admin" | "sales" }
      }
      temp_password?: string | null
    }>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: user.email,
        display_name: user.name,
        role: user.role,
        invite,
        ...(invite ? {} : { temp_password: tempPassword }),
      }),
    })

    const mapped = toUser(response.item.profile, response.item.auth_user.email)
    setUsers((prev) => [...prev, mapped])
    return {
      tempPassword: response.temp_password ?? (invite ? null : tempPassword ?? null),
    }
  }, [])

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    const response = await apiFetch<{
      item: { user_id: string; display_name: string; role: "admin" | "sales"; is_disabled: boolean }
    }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(updates.name !== undefined ? { display_name: updates.name } : {}),
        ...(updates.role !== undefined ? { role: updates.role } : {}),
      }),
    })

    const mapped = toUser(response.item)
    setUsers((prev) =>
      prev.map((user) =>
        user.id === id
          ? {
              ...mapped,
              email: user.email,
            }
          : user,
      ),
    )
  }, [])

  const deleteUser = useCallback(async (id: string) => {
    await apiFetch(`/api/admin/users/${id}`, {
      method: "DELETE",
    })
    setUsers((prev) => prev.filter((user) => user.id !== id))
  }, [])

  const value: StoreContextValue = {
    isAuthenticated,
    isBootstrapping,
    loginWithPassword,
    loginWithMagicLink,
    logout,
    refresh,
    currentUser,
    allUsers: users,
    org,
    updateLogo,
    tables,
    addTable,
    updateTable,
    deleteTable,
    loadTableWorkspace,
    permissions,
    updatePermission,
    getAccess,
    getPermittedTables,
    leads,
    updateLead,
    saveLead,
    addLead,
    claimLead,
    logTouchLead,
    archiveLead,
    restoreLead,
    runBulkAction,
    services,
    addService,
    updateService,
    deleteService,
    favorites,
    toggleFavorite,
    events,
    addEvent,
    loadLeadArtifacts,
    attachments,
    uploadAttachment,
    users,
    addUser,
    updateUser,
    deleteUser,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
