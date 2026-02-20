"use client"

import React, { useMemo } from "react"
import { format } from "date-fns"
import { useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { StageBadge } from "@/components/stage-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Ban } from "lucide-react"

interface MyLeadsTabProps {
  tableId: string
  onSelectLead: (id: string) => void
}

export function MyLeadsTab({ tableId, onSelectLead }: MyLeadsTabProps) {
  const { leads, currentUser, services } = useStore()

  const myLeads = useMemo(
    () =>
      leads.filter(
        (l) =>
          l.tableId === tableId &&
          l.ownerId === currentUser.id &&
          !l.isArchived
      ),
    [leads, tableId, currentUser.id]
  )

  const getServiceNames = (ids: string[]) =>
    ids.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean)

  if (myLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">
          You have no leads in this table. Claim some from the New Leads tab!
        </p>
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
            <TableHead>Next follow-up</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Services</TableHead>
            <TableHead>Last touched</TableHead>
            <TableHead>DNC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {myLeads.map((lead) => {
            const serviceNames = getServiceNames(lead.interestedServices)

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
                <TableCell className="text-sm">
                  {lead.nextFollowUpAt
                    ? format(new Date(lead.nextFollowUpAt), "MMM d, yyyy")
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {lead.followUpWindow}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px]">
                    {lead.sourceType}
                  </Badge>
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
                  {format(new Date(lead.lastTouchedAt), "MMM d")}
                </TableCell>
                <TableCell>
                  {lead.doNotContact && (
                    <Ban className="h-4 w-4 text-destructive" />
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
