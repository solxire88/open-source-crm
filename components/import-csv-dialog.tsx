"use client"

import React, { useState } from "react"
import { toast } from "sonner"
import type { SourceType } from "@/lib/types"
import { SOURCE_TYPES } from "@/lib/types"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react"
import { useStore } from "@/lib/store"

interface ImportCsvDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
}

interface ImportResponse {
  imported_count: number
  duplicate_candidates: Array<{
    row_index: number
    business_name: string
    reasons: string[]
  }>
  batch_id: string | null
  invalid_rows?: number
}

export function ImportCsvDialog({ open, onOpenChange, tableId }: ImportCsvDialogProps) {
  const { loadTableWorkspace } = useStore()
  const [file, setFile] = useState<File | null>(null)
  const [defaultSource, setDefaultSource] = useState<SourceType>("Unknown")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ImportResponse | null>(null)

  const reset = () => {
    setFile(null)
    setDefaultSource("Unknown")
    setSubmitting(false)
    setResult(null)
  }

  const handleImport = async () => {
    if (!file) {
      toast.error("Choose a CSV file first")
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append(
        "config",
        JSON.stringify({
          default_source_type: defaultSource,
        }),
      )

      const response = await fetch(`/api/tables/${tableId}/import`, {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as ImportResponse | { error?: { message?: string } }

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          payload.error?.message
            ? payload.error.message
            : "CSV import failed"
        throw new Error(message)
      }

      setResult(payload as ImportResponse)
      await loadTableWorkspace(tableId)
      toast.success("Import completed")
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSV import failed"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import leads into this table.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>CSV file</Label>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Default source type</Label>
            <Select value={defaultSource} onValueChange={(value) => setDefaultSource(value as SourceType)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {result ? (
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>
                  Imported <strong>{result.imported_count}</strong> leads
                </span>
              </div>
              {typeof result.invalid_rows === "number" && result.invalid_rows > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Skipped {result.invalid_rows} invalid row(s).
                </p>
              ) : null}
              {result.duplicate_candidates.length > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{result.duplicate_candidates.length} duplicate candidates detected</span>
                  </div>
                  <ul className="text-xs text-muted-foreground list-disc pl-4">
                    {result.duplicate_candidates.slice(0, 5).map((candidate) => (
                      <li key={`${candidate.row_index}-${candidate.business_name}`}>
                        Row {candidate.row_index}: {candidate.business_name} ({candidate.reasons.join(", ")})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => void handleImport()} disabled={submitting || !file} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            {submitting ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
