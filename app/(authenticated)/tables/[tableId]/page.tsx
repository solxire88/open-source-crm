"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Plus,
  Upload,
  Download,
  CheckSquare,
  ChevronRight,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PipelineTab } from "@/components/tabs/pipeline-tab"
import { NewLeadsTab } from "@/components/tabs/new-leads-tab"
import { MyLeadsTab } from "@/components/tabs/my-leads-tab"
import { FollowupsTab } from "@/components/tabs/followups-tab"
import { CalendarTab } from "@/components/tabs/calendar-tab"
import { LeadDetailDrawer } from "@/components/lead-detail-drawer"
import { AddLeadDialog } from "@/components/add-lead-dialog"
import { ImportCsvDialog } from "@/components/import-csv-dialog"
import { ExportCsvDialog } from "@/components/export-csv-dialog"
import { BulkActionsBar } from "@/components/bulk-actions-bar"

export default function TableWorkspacePage() {
  const params = useParams()
  const tableId = params.tableId as string
  const { tables, getAccess, currentUser, loadTableWorkspace, isBootstrapping } = useStore()
  const table = tables.find((t) => t.id === tableId)
  const access = getAccess(tableId)
  const canEdit = access === "edit"
  const isAdmin = currentUser.role === "admin"

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [addLeadOpen, setAddLeadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])

  const handleSelectLead = useCallback((id: string) => {
    setSelectedLeadId(id)
    setDrawerOpen(true)
  }, [])

  useEffect(() => {
    if (!tableId || !access) return
    void loadTableWorkspace(tableId)
  }, [access, loadTableWorkspace, tableId])

  if (isBootstrapping) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    )
  }

  if (!table) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Table not found</p>
      </div>
    )
  }

  if (!access) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">You do not have access to this table.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Tables</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-3.5 w-3.5" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{table.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setBulkMode(!bulkMode)}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                {bulkMode ? "Exit bulk" : "Bulk"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
            </>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setExportOpen(true)}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setAddLeadOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Lead
            </Button>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {bulkMode && selectedLeadIds.length > 0 && (
        <BulkActionsBar
          tableId={tableId}
          selectedIds={selectedLeadIds}
          onClear={() => setSelectedLeadIds([])}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="followups" className="flex-1 flex flex-col">
        <div className="border-b px-6">
          <TabsList className="h-10 bg-transparent p-0 gap-4">
            <TabsTrigger
              value="pipeline"
              className="rounded-none border-b-2 border-transparent px-1 pb-2.5 pt-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Pipeline
            </TabsTrigger>
            <TabsTrigger
              value="new-leads"
              className="rounded-none border-b-2 border-transparent px-1 pb-2.5 pt-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              New Leads
            </TabsTrigger>
            <TabsTrigger
              value="my-leads"
              className="rounded-none border-b-2 border-transparent px-1 pb-2.5 pt-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              My Leads
            </TabsTrigger>
            <TabsTrigger
              value="followups"
              className="rounded-none border-b-2 border-transparent px-1 pb-2.5 pt-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Follow-ups Due
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="rounded-none border-b-2 border-transparent px-1 pb-2.5 pt-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Calendar
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="pipeline" className="mt-0 h-full">
            <PipelineTab tableId={tableId} onSelectLead={handleSelectLead} />
          </TabsContent>
          <TabsContent value="new-leads" className="mt-0">
            <NewLeadsTab tableId={tableId} onSelectLead={handleSelectLead} />
          </TabsContent>
          <TabsContent value="my-leads" className="mt-0">
            <MyLeadsTab tableId={tableId} onSelectLead={handleSelectLead} />
          </TabsContent>
          <TabsContent value="followups" className="mt-0">
            <FollowupsTab tableId={tableId} onSelectLead={handleSelectLead} />
          </TabsContent>
          <TabsContent value="calendar" className="mt-0">
            <CalendarTab tableId={tableId} onSelectLead={handleSelectLead} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Lead detail drawer */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        tableId={tableId}
      />

      {/* Add lead dialog */}
      <AddLeadDialog
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        tableId={tableId}
      />

      {/* Import CSV dialog */}
      <ImportCsvDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        tableId={tableId}
      />

      {/* Export CSV dialog */}
      <ExportCsvDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        tableId={tableId}
      />
    </div>
  )
}
