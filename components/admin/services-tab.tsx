"use client"

import React, { useState } from "react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import type { Service } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Archive, Plus } from "lucide-react"

export function AdminServicesTab() {
  const { tables, services, addService, updateService } = useStore()
  const nonArchivedTables = tables.filter((t) => !t.isArchived)
  const [selectedTableId, setSelectedTableId] = useState(nonArchivedTables[0]?.id ?? "")
  const [newServiceName, setNewServiceName] = useState("")

  const tableServices = services.filter((s) => s.tableId === selectedTableId)

  const handleAdd = async () => {
    if (!newServiceName.trim()) {
      toast.error("Service name is required")
      return
    }
    // Check for duplicates
    const duplicate = tableServices.find(
      (s) => s.name.toLowerCase() === newServiceName.trim().toLowerCase() && !s.isArchived
    )
    if (duplicate) {
      toast.error("A service with this name already exists in this table")
      return
    }

    const newService: Service = {
      id: `s-${Date.now()}`,
      tableId: selectedTableId,
      name: newServiceName.trim(),
      isArchived: false,
    }
    try {
      await addService(newService)
      setNewServiceName("")
      toast.success(`Added service: ${newService.name}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add service"
      toast.error(message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Label className="text-sm shrink-0">Table:</Label>
        <Select value={selectedTableId} onValueChange={setSelectedTableId}>
          <SelectTrigger className="w-56 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {nonArchivedTables.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newServiceName}
          onChange={(e) => setNewServiceName(e.target.value)}
          placeholder="New service name"
          className="max-w-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void handleAdd()
            }
          }}
        />
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => void handleAdd()}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableServices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                  No services for this table yet.
                </TableCell>
              </TableRow>
            ) : (
              tableServices.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell>
                    {service.isArchived ? (
                      <Badge variant="outline" className="text-xs">Archived</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        void (async () => {
                          try {
                            await updateService(service.id, { isArchived: !service.isArchived })
                            toast.success(service.isArchived ? "Service restored" : "Service archived")
                          } catch (error) {
                            const message =
                              error instanceof Error ? error.message : "Failed to update service"
                            toast.error(message)
                          }
                        })()
                      }}
                    >
                      <Archive className="h-3 w-3" />
                      {service.isArchived ? "Restore" : "Archive"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
