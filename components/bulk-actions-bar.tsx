"use client"

import React from "react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { STAGES } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { addDays, format } from "date-fns"
import { Archive, Calendar, Tag, User, X } from "lucide-react"

interface BulkActionsBarProps {
  tableId: string
  selectedIds: string[]
  onClear: () => void
}

type BulkActionsBarAction =
  | "assign_owner"
  | "change_stage"
  | "set_source"
  | "set_followup"
  | "add_services"
  | "remove_services"
  | "archive"

export function BulkActionsBar({ tableId, selectedIds, onClear }: BulkActionsBarProps) {
  const { allUsers, runBulkAction } = useStore()

  const applyBulk = async (action: BulkActionsBarAction, payload: Record<string, unknown> = {}) => {
    try {
      await runBulkAction(tableId, {
        lead_ids: selectedIds,
        action,
        payload,
      })
      toast.success(`Updated ${selectedIds.length} leads`)
      onClear()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk action failed"
      toast.error(message)
    }
  }

  return (
    <div className="flex items-center gap-3 border-b bg-muted/50 px-6 py-2">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>

      {/* Assign owner */}
      <Select onValueChange={(v) => void applyBulk("assign_owner", { owner_id: v === "unassigned" ? null : v })}>
        <SelectTrigger className="h-7 w-36 text-xs">
          <User className="h-3 w-3 mr-1" />
          <SelectValue placeholder="Assign owner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {allUsers.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Change stage */}
      <Select onValueChange={(v) => void applyBulk("change_stage", { stage: v })}>
        <SelectTrigger className="h-7 w-32 text-xs">
          <Tag className="h-3 w-3 mr-1" />
          <SelectValue placeholder="Set stage" />
        </SelectTrigger>
        <SelectContent>
          {STAGES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quick follow-up */}
      <Select
        onValueChange={(v) => {
          const date = addDays(new Date(), parseInt(v))
          void applyBulk("set_followup", {
            next_followup_at: format(date, "yyyy-MM-dd"),
          })
        }}
      >
        <SelectTrigger className="h-7 w-36 text-xs">
          <Calendar className="h-3 w-3 mr-1" />
          <SelectValue placeholder="Set follow-up" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">Today</SelectItem>
          <SelectItem value="1">Tomorrow</SelectItem>
          <SelectItem value="2">+2 days</SelectItem>
          <SelectItem value="7">+7 days</SelectItem>
          <SelectItem value="30">+30 days</SelectItem>
        </SelectContent>
      </Select>

      {/* Archive */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <Archive className="h-3 w-3" /> Archive
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedIds.length} leads?</AlertDialogTitle>
            <AlertDialogDescription>
              These leads will be archived and hidden from active views.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyBulk("archive")}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button variant="ghost" size="sm" className="h-7 ml-auto" onClick={onClear}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
