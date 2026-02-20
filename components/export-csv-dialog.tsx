"use client"

import React, { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Download } from "lucide-react"

interface ExportCsvDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
}

const TEMPLATES = [
  { id: "full", label: "Full export", description: "All lead fields" },
  { id: "calling", label: "Calling list", description: "Business name, contact, stage, follow-up" },
  { id: "source_report", label: "Ads/Source report", description: "Business name, source type, source detail, stage" },
  { id: "services_report", label: "Services interest report", description: "Business name, interested services, stage" },
]

export function ExportCsvDialog({ open, onOpenChange, tableId }: ExportCsvDialogProps) {
  const [template, setTemplate] = useState("full")
  const [includeArchived, setIncludeArchived] = useState(false)
  const [includeDnc, setIncludeDnc] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleExport = async () => {
    setSubmitting(true)
    try {
      const params = new URLSearchParams()
      params.set("template", template)
      params.set("includeArchived", includeArchived ? "1" : "0")
      params.set("includeDnc", includeDnc ? "1" : "0")

      const response = await fetch(`/api/tables/${tableId}/export?${params.toString()}`)
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

      toast.success(`Export ready: ${TEMPLATES.find((t) => t.id === template)?.label}`)
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export CSV</DialogTitle>
          <DialogDescription>
            Choose an export template and options.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <RadioGroup value={template} onValueChange={setTemplate} className="gap-3">
            {TEMPLATES.map((t) => (
              <div key={t.id} className="flex items-start gap-3">
                <RadioGroupItem value={t.id} id={t.id} className="mt-0.5" />
                <Label htmlFor={t.id} className="cursor-pointer">
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Include archived leads</Label>
              <Switch checked={includeArchived} onCheckedChange={setIncludeArchived} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Include DNC leads</Label>
              <Switch checked={includeDnc} onCheckedChange={setIncludeDnc} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void handleExport()} className="gap-1.5" disabled={submitting}>
            <Download className="h-3.5 w-3.5" />
            {submitting ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
