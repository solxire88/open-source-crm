"use client"

import React from "react"
import { useStore } from "@/lib/store"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminUsersTab } from "@/components/admin/users-tab"
import { AdminTablesTab } from "@/components/admin/tables-tab"
import { AdminPermissionsTab } from "@/components/admin/permissions-tab"
import { AdminServicesTab } from "@/components/admin/services-tab"
import { AdminExportsTab } from "@/components/admin/exports-tab"
import { AdminBrandingTab } from "@/components/admin/branding-tab"

export default function AdminPage() {
  const { currentUser, isBootstrapping } = useStore()

  if (isBootstrapping) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    )
  }

  if (currentUser.role !== "admin") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Admin access required. You do not have permission to view this page.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin Console</h1>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <AdminUsersTab />
        </TabsContent>
        <TabsContent value="tables" className="mt-4">
          <AdminTablesTab />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <AdminPermissionsTab />
        </TabsContent>
        <TabsContent value="services" className="mt-4">
          <AdminServicesTab />
        </TabsContent>
        <TabsContent value="exports" className="mt-4">
          <AdminExportsTab />
        </TabsContent>
        <TabsContent value="branding" className="mt-4">
          <AdminBrandingTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
