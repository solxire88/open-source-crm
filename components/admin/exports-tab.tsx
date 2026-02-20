"use client"

import React from "react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, FileSpreadsheet } from "lucide-react"

const TEMPLATES = [
  { id: "full", label: "Full export", description: "All lead fields" },
  { id: "calling", label: "Calling list", description: "Business name, contact, stage, follow-up" },
  { id: "source_report", label: "Ads/Source report", description: "Source type, source detail, stage" },
  { id: "services_report", label: "Services interest", description: "Business name, services, stage" },
]

export function AdminExportsTab() {
  const { tables } = useStore()
  const nonArchivedTables = tables.filter((t) => !t.isArchived)

  const handleExport = async (tableId: string, template: string) => {
    try {
      const response = await fetch(
        `/api/tables/${tableId}/export?template=${template}&includeArchived=0&includeDnc=0`,
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message =
          payload?.error?.message && typeof payload.error.message === "string"
            ? payload.error.message
            : "Export failed"
        throw new Error(message)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `table-${tableId}-${template}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success("Export ready")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed"
      toast.error(message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Quick export shortcuts for each table.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {nonArchivedTables.map((table) => (
          <Card key={table.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                {table.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {TEMPLATES.map((t) => (
                <Button
                  key={t.id}
                  variant="outline"
                  size="sm"
                  className="justify-start text-xs gap-2 h-8"
                  onClick={() => void handleExport(table.id, t.id)}
                >
                  <Download className="h-3 w-3" />
                  {t.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
