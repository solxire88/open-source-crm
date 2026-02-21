"use client"

import { useStore } from "@/lib/store"

export function useCurrentUser() {
  const { currentUser, allUsers } = useStore()
  return { user: currentUser, allUsers }
}

export function useOrgSettings() {
  const { org, updateLogo } = useStore()
  return { org, updateLogo }
}

export function usePermittedTables() {
  const { getPermittedTables, permissions, getAccess } = useStore()
  return { tables: getPermittedTables(), permissions, getAccess }
}

export function useLeads() {
  const { leads, updateLead, addLead } = useStore()
  return { leads, updateLead, addLead }
}

export function useServices() {
  const { services, addService, updateService, deleteService } = useStore()
  return { services, addService, updateService, deleteService }
}

export function useFavorites() {
  const { favorites, toggleFavorite } = useStore()
  return { favorites, toggleFavorite }
}

export function useLeadEvents() {
  const { events } = useStore()
  return { events }
}

export function useAttachments() {
  const { attachments } = useStore()
  return { attachments }
}

export function useUsersManagement() {
  const { users, addUser, updateUser, deleteUser } = useStore()
  return { users, addUser, updateUser, deleteUser }
}
