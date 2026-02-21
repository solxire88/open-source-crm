"use client"

import React, { useState } from "react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import type { SalesTable, SourceType, Stage } from "@/lib/types"
import { STAGES, SOURCE_TYPES } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Archive, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

export function AdminTablesTab() {
  const { tables, addTable, updateTable, deleteTable } = useStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTable, setEditTable] = useState<SalesTable | null>(null)
  const [name, setName] = useState("")
  const [defaultStage, setDefaultStage] = useState<Stage>("New")
  const [defaultSource, setDefaultSource] = useState<SourceType>("Unknown")

  const reset = () => {
    setName("")
    setDefaultStage("New")
    setDefaultSource("Unknown")
    setEditTable(null)
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Table name is required")
      return
    }
    const newTable: SalesTable = {
      id: `t-${Date.now()}`,
      name: name.trim(),
      isArchived: false,
      defaults: { defaultStage, defaultSourceType: defaultSource },
    }
    try {
      await addTable(newTable)
      toast.success(`Created table: ${newTable.name}`)
      reset()
      setCreateOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create table"
      toast.error(message)
    }
  }

  const handleEdit = async () => {
    if (!editTable || !name.trim()) return
    try {
      await updateTable(editTable.id, {
        name: name.trim(),
        defaults: { defaultStage, defaultSourceType: defaultSource },
      })
      toast.success("Table updated")
      reset()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update table"
      toast.error(message)
    }
  }

  const openEdit = (table: SalesTable) => {
    setEditTable(table)
    setName(table.name)
    setDefaultStage(table.defaults.defaultStage)
    setDefaultSource(table.defaults.defaultSourceType)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tables.length} tables</p>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Create table
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Default Stage</TableHead>
              <TableHead>Default Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.map((table) => (
              <TableRow key={table.id}>
                <TableCell className="font-medium">{table.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{table.defaults.defaultStage}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{table.defaults.defaultSourceType}</Badge>
                </TableCell>
                <TableCell>
                  {table.isArchived ? (
                    <Badge variant="outline" className="text-xs">Archived</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">Active</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(table)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          void (async () => {
                            try {
                              await updateTable(table.id, { isArchived: !table.isArchived })
                              toast.success(table.isArchived ? "Table restored" : "Table archived")
                            } catch (error) {
                              const message =
                                error instanceof Error ? error.message : "Failed to update table"
                              toast.error(message)
                            }
                          })()
                        }}
                      >
                        <Archive className="mr-2 h-3.5 w-3.5" />
                        {table.isArchived ? "Restore" : "Archive"}
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(event) => event.preventDefault()}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {table.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes the table and all related leads, services,
                              permissions, events, imports, and attachments.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await deleteTable(table.id)
                                    toast.success("Table deleted")
                                  } catch (error) {
                                    const message =
                                      error instanceof Error
                                        ? error.message
                                        : "Failed to delete table"
                                    toast.error(message)
                                  }
                                })()
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit dialog */}
      <Dialog
        open={createOpen || !!editTable}
        onOpenChange={(v) => { if (!v) { setCreateOpen(false); reset() } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTable ? "Edit Table" : "Create Table"}</DialogTitle>
            <DialogDescription>
              {editTable ? "Update table settings." : "Create a new sales table."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Restaurant Leads" />
            </div>
            <div className="grid gap-1.5">
              <Label>Default stage</Label>
              <Select value={defaultStage} onValueChange={(v) => setDefaultStage(v as Stage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Default source type</Label>
              <Select value={defaultSource} onValueChange={(v) => setDefaultSource(v as SourceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); reset() }}>Cancel</Button>
            <Button onClick={() => void (editTable ? handleEdit() : handleCreate())}>
              {editTable ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
