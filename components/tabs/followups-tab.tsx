"use client"

import React, { useMemo } from "react"
import { format, isToday, isBefore, startOfDay, addDays } from "date-fns"
import { useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StageBadge } from "@/components/stage-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { STAGES, type Stage } from "@/lib/types"
import { Calendar, Clock, MoreHorizontal, Ban, Pencil } from "lucide-react"
import { toast } from "sonner"

interface FollowupsTabProps {
  tableId: string
  onSelectLead: (id: string) => void
}

export function FollowupsTab({ tableId, onSelectLead }: FollowupsTabProps) {
  const { leads, updateLead, allUsers, getAccess, logTouchLead } = useStore()
  const access = getAccess(tableId)
  const canEdit = access === "edit"

  const dueLeads = useMemo(() => {
    const now = new Date()
    return leads
      .filter(
        (l) =>
          l.tableId === tableId &&
          l.nextFollowUpAt &&
          new Date(l.nextFollowUpAt) <= now &&
          l.stage !== "Won" &&
          l.stage !== "Lost" &&
          !l.doNotContact &&
          !l.isArchived
      )
      .sort((a, b) => {
        // Overdue first (oldest first), then by window
        const aDate = new Date(a.nextFollowUpAt!)
        const bDate = new Date(b.nextFollowUpAt!)
        if (aDate.getTime() !== bDate.getTime()) return aDate.getTime() - bDate.getTime()
        const windowOrder = { Morning: 0, Afternoon: 1, Anytime: 2 }
        return windowOrder[a.followUpWindow] - windowOrder[b.followUpWindow]
      })
  }, [leads, tableId])

  const getOwnerName = (ownerId: string | null) =>
    ownerId ? (allUsers.find((u) => u.id === ownerId)?.name ?? "Unknown") : "Unassigned"

  const reschedule = (leadId: string, days: number) => {
    const date = addDays(new Date(), days)
    updateLead(leadId, { nextFollowUpAt: date.toISOString() })
    toast.success(`Rescheduled to ${format(date, "MMM d")}`)
  }

  const logTouch = async (leadId: string) => {
    try {
      await logTouchLead(leadId, "Follow-up touched")
      toast.success("Touch logged")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to log touch"
      toast.error(message)
    }
  }

  if (dueLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No follow-ups due. All caught up!</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Last touched</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dueLeads.map((lead) => {
            const dueDate = new Date(lead.nextFollowUpAt!)
            const overdue = isBefore(dueDate, startOfDay(new Date()))
            const dueToday = isToday(dueDate)

            return (
              <TableRow
                key={lead.id}
                className="cursor-pointer"
                onClick={() => onSelectLead(lead.id)}
              >
                <TableCell className="font-medium">{lead.businessName}</TableCell>
                <TableCell>
                  <StageBadge stage={lead.stage} className="text-[10px]" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{format(dueDate, "MMM d")}</span>
                    {overdue && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0">
                        Overdue
                      </Badge>
                    )}
                    {dueToday && !overdue && (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-0 text-[9px] px-1 py-0">
                        Today
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {lead.followUpWindow}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {getOwnerName(lead.ownerId)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(lead.lastTouchedAt), "MMM d")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {/* Quick reschedule presets */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={!canEdit}>
                          <Clock className="h-3 w-3" /> Reschedule
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => reschedule(lead.id, 0)}>Today</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => reschedule(lead.id, 1)}>Tomorrow</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => reschedule(lead.id, 2)}>+2 days</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => reschedule(lead.id, 7)}>+7 days</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => reschedule(lead.id, 30)}>+30 days</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Stage quick set */}
                    <Select
                      value={lead.stage}
                      onValueChange={(v) => {
                        updateLead(lead.id, {
                          stage: v as Stage,
                          stageChangedAt: new Date().toISOString(),
                        })
                        toast.success(`Stage changed to ${v}`)
                      }}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* More actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void logTouch(lead.id)} disabled={!canEdit}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Log touch
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            updateLead(lead.id, { doNotContact: true })
                            toast.success("Marked as DNC")
                          }}
                          disabled={!canEdit}
                        >
                          <Ban className="mr-2 h-3.5 w-3.5" /> Mark DNC
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
