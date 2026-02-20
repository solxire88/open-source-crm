"use client"

import React, { useMemo } from "react"
import { useStore } from "@/lib/store"
import { STAGES, type Stage, type Lead } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { StageBadge } from "@/components/stage-badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Clock, User, Ban } from "lucide-react"

interface PipelineTabProps {
  tableId: string
  onSelectLead: (id: string) => void
}

export function PipelineTab({ tableId, onSelectLead }: PipelineTabProps) {
  const { leads, updateLead, allUsers, services } = useStore()

  const tableLeads = useMemo(
    () => leads.filter((l) => l.tableId === tableId && !l.isArchived),
    [leads, tableId]
  )

  const columns = useMemo(() => {
    return STAGES.map((stage) => ({
      stage,
      leads: tableLeads.filter((l) => l.stage === stage),
    }))
  }, [tableLeads])

  const getOwnerName = (ownerId: string | null) =>
    ownerId ? (allUsers.find((u) => u.id === ownerId)?.name?.split(" ")[0] ?? "?") : null

  const getServiceNames = (ids: string[]) =>
    ids.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean)

  const handleDrop = (e: React.DragEvent, targetStage: Stage) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData("text/plain")
    if (leadId) {
      updateLead(leadId, {
        stage: targetStage,
        stageChangedAt: new Date().toISOString(),
      })
    }
  }

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("text/plain", leadId)
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 p-1 pb-4 min-w-max">
        {columns.map(({ stage, leads: columnLeads }) => (
          <div
            key={stage}
            className="flex flex-col w-72 shrink-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, stage)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <StageBadge stage={stage} className="text-xs" />
                <span className="text-xs text-muted-foreground font-medium">
                  {columnLeads.length}
                </span>
              </div>
            </div>

            {/* Column body */}
            <div className="flex flex-col gap-2 min-h-[200px] rounded-lg bg-muted/50 p-2">
              {columnLeads.map((lead) => {
                const owner = getOwnerName(lead.ownerId)
                const serviceNames = getServiceNames(lead.interestedServices)
                const showServices = serviceNames.slice(0, 2)
                const moreCount = serviceNames.length - showServices.length

                return (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onClick={() => onSelectLead(lead.id)}
                    className={cn(
                      "rounded-md border bg-card p-3 cursor-pointer transition-shadow hover:shadow-md",
                      lead.doNotContact && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-medium text-sm truncate text-card-foreground">
                        {lead.businessName}
                      </span>
                      {lead.doNotContact && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">
                          <Ban className="h-2.5 w-2.5" />
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {owner && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{owner}</span>
                        </div>
                      )}

                      {lead.nextFollowUpAt && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{format(new Date(lead.nextFollowUpAt), "MMM d")}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            {lead.followUpWindow}
                          </Badge>
                        </div>
                      )}

                      {lead.sourceType !== "Unknown" && (
                        <Badge variant="secondary" className="text-[10px] w-fit">
                          {lead.sourceType}
                        </Badge>
                      )}

                      {showServices.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {showServices.map((name) => (
                            <Badge key={name} variant="outline" className="text-[9px] px-1.5 py-0">
                              {name}
                            </Badge>
                          ))}
                          {moreCount > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              +{moreCount}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {columnLeads.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground py-8">
                  No leads
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
