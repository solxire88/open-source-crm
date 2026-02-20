"use client"

import React, { useMemo } from "react"
import { useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { UserPlus, Globe } from "lucide-react"
import { toast } from "sonner"

interface NewLeadsTabProps {
  tableId: string
  onSelectLead: (id: string) => void
}

export function NewLeadsTab({ tableId, onSelectLead }: NewLeadsTabProps) {
  const { leads, claimLead, allUsers, services, getAccess } = useStore()
  const access = getAccess(tableId)
  const canEdit = access === "edit"

  const newLeads = useMemo(
    () =>
      leads.filter(
        (l) =>
          l.tableId === tableId &&
          l.stage === "New" &&
          !l.doNotContact &&
          !l.isArchived
      ),
    [leads, tableId]
  )

  const getOwnerName = (ownerId: string | null) =>
    ownerId ? (allUsers.find((u) => u.id === ownerId)?.name ?? "Unknown") : null

  const getServiceNames = (ids: string[]) =>
    ids.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean)

  const handleClaim = async (leadId: string) => {
    try {
      await claimLead(leadId)
      toast.success("Lead claimed!")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to claim lead"
      toast.error(message)
    }
  }

  const stripUrl = (url: string) => {
    try {
      return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
    } catch {
      return url
    }
  }

  if (newLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">No new leads available</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Website</TableHead>
            <TableHead>Services</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {newLeads.map((lead) => {
            const owner = getOwnerName(lead.ownerId)
            const serviceNames = getServiceNames(lead.interestedServices)

            return (
              <TableRow
                key={lead.id}
                className="cursor-pointer"
                onClick={() => onSelectLead(lead.id)}
              >
                <TableCell className="font-medium">{lead.businessName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {lead.sourceType}
                    </Badge>
                    {lead.sourceDetail && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground cursor-help truncate max-w-[80px]">
                            {lead.sourceDetail}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{lead.sourceDetail}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{lead.contact || "—"}</TableCell>
                <TableCell>
                  {lead.websiteUrl ? (
                    <a
                      href={lead.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Globe className="h-3 w-3" />
                      {stripUrl(lead.websiteUrl)}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {serviceNames.slice(0, 2).map((name) => (
                      <Badge key={name} variant="outline" className="text-[10px] px-1.5 py-0">
                        {name}
                      </Badge>
                    ))}
                    {serviceNames.length > 2 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        +{serviceNames.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {owner ?? "—"}
                </TableCell>
                <TableCell>
                  {!lead.ownerId && canEdit ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleClaim(lead.id)
                      }}
                    >
                      <UserPlus className="h-3 w-3" />
                      Claim
                    </Button>
                  ) : lead.ownerId ? (
                    <span className="text-xs text-muted-foreground">Claimed</span>
                  ) : null}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
