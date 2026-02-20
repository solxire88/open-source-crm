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
  loadTableWorkspace: (tableId: string) => Promise<void>
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

  const resetState = useCallback(() => {
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

  const fetchTableLeads = useCallback(async (tableId: string) => {
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
    }>(
      (offset, limit) =>
        `/api/tables/${tableId}/leads?view=all&includeArchived=1&includeDnc=1&limit=${limit}&offset=${offset}`,
    )

    return rows.map((row) => toLead(row))
  }, [])

  const refresh = useCallback(async () => {
    setIsBootstrapping(true)

    try {
      const meResponse = await apiFetch<{
        user: { id: string; email?: string | null }
        profile: { user_id: string; display_name: string; role: "admin" | "sales" }
        organization: { id: string; name: string; logo_url?: string | null; logo_signed_url?: string | null }
      }>("/api/me")

      const meUser = toUser(
        {
          user_id: meResponse.profile.user_id,
          display_name: meResponse.profile.display_name,
          role: meResponse.profile.role,
        },
        meResponse.user.email,
      )

      setCurrentUser(meUser)
      setOrg(toOrg(meResponse.organization))
      setIsAuthenticated(true)

      const [tablesResponse, usersResponse, favoritesResponse] = await Promise.all([
        fetchAllPages<{
          id: string
          name: string
          is_archived: boolean
          default_stage: Lead["stage"]
          default_source_type: Lead["sourceType"] | null
          default_source_detail: string | null
          access_level: "read" | "edit"
        }>((offset, limit) => `/api/tables?includeArchived=1&limit=${limit}&offset=${offset}`),
        fetchAllPages<{
          user_id: string
          display_name: string
          role: "admin" | "sales"
          is_disabled: boolean
        }>((offset, limit) => `/api/users?limit=${limit}&offset=${offset}`),
        apiFetch<{ table_ids: string[] }>("/api/favorites/tables"),
      ])

      const mappedTables = tablesResponse.map(toSalesTable)
      setTables(mappedTables)
      setFavorites(favoritesResponse.table_ids ?? [])

      const mappedUsers = usersResponse.map((user) => toUser(user))
      const hasCurrent = mappedUsers.some((user) => user.id === meUser.id)
      const mergedUsers = hasCurrent ? mappedUsers : [meUser, ...mappedUsers]
      setUsers(mergedUsers)

      if (meUser.role === "admin") {
        const permissionsByTable = await Promise.all(
          mappedTables.map(async (table) => {
            const response = await fetchAllPages<{
              user_id: string
              access_level: "read" | "edit"
            }>(
              (offset, limit) =>
                `/api/tables/${table.id}/permissions?limit=${limit}&offset=${offset}`,
            )

            return response.map((entry) =>
              toTablePermission({
                table_id: table.id,
                user_id: entry.user_id,
                access_level: entry.access_level,
              }),
            )
          }),
        )

        setPermissions(permissionsByTable.flat())
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

      const tableIds = mappedTables.map((table) => table.id)

      const [servicesRows, leadsRows] = await Promise.all([
        Promise.all(tableIds.map((tableId) => fetchTableServices(tableId))),
        Promise.all(tableIds.map((tableId) => fetchTableLeads(tableId))),
      ])

      setServices(servicesRows.flat())
      setLeads(leadsRows.flat())
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        resetState()
      } else {
        console.error(error)
        resetState()
      }
    } finally {
      setIsBootstrapping(false)
    }
  }, [fetchTableLeads, fetchTableServices, resetState])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh()
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
    async (tableId: string) => {
      const [tableServices, tableLeads] = await Promise.all([
        fetchTableServices(tableId),
        fetchTableLeads(tableId),
      ])

      setServices((prev) => [
        ...prev.filter((service) => service.tableId !== tableId),
        ...tableServices,
      ])
      setLeads((prev) => [...prev.filter((lead) => lead.tableId !== tableId), ...tableLeads])
    },
    [fetchTableLeads, fetchTableServices],
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

  const updatePermission = useCallback(
    async (tableId: string, userId: string, access: AccessLevel | null) => {
      const nextPermissions = (() => {
        const filtered = permissions.filter(
          (entry) => !(entry.tableId === tableId && entry.userId === userId),
        )
        if (access === null) return filtered
        return [...filtered, { tableId, userId, access }]
      })()

      setPermissions(nextPermissions)

      const payload = nextPermissions
        .filter((entry) => entry.tableId === tableId)
        .map((entry) => ({
          user_id: entry.userId,
          access_level: entry.access,
        }))

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
    },
    [permissions],
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
        }
      }>(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })

      const serviceIds =
        "interestedServices" in pendingUpdates
          ? pendingUpdates.interestedServices
          : undefined

      const mapped = toLead(response.item, serviceIds)
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? mapped : lead)))
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
  }, [])

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
      }
    }>(`/api/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })

    const serviceIds =
      "interestedServices" in preparedUpdates ? preparedUpdates.interestedServices : undefined

    const mapped = toLead(response.item, serviceIds)
    setLeads((prev) => prev.map((lead) => (lead.id === id ? mapped : lead)))
  }, [leads])

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
  }, [])

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
  }, [])

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
    },
    [],
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
  }, [])

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
  }, [])

  const runBulkAction = useCallback(
    async (tableId: string, payload: BulkActionInput) => {
      await apiFetch(`/api/tables/${tableId}/leads/bulk`, {
        method: "POST",
        body: JSON.stringify(payload),
      })

      await loadTableWorkspace(tableId)
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
  }, [])

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
    },
    [services],
  )

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
