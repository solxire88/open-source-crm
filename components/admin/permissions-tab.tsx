"use client"

import React from "react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import type { AccessLevel } from "@/lib/types"
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

export function AdminPermissionsTab() {
  const { users, tables, permissions, updatePermission } = useStore()

  const nonArchivedTables = tables.filter((t) => !t.isArchived)
  const nonAdminUsers = users.filter((u) => u.role === "sales")

  const getAccess = (tableId: string, userId: string): string => {
    const perm = permissions.find((p) => p.tableId === tableId && p.userId === userId)
    return perm?.access ?? "none"
  }

  const handleChange = async (tableId: string, userId: string, value: string) => {
    try {
      await updatePermission(tableId, userId, value === "none" ? null : (value as AccessLevel))
      toast.success("Permission updated")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update permission"
      toast.error(message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Manage which salespeople can access each table. Admins always have full edit access.
      </p>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px] sticky left-0 bg-background z-10">User</TableHead>
              {nonArchivedTables.map((t) => (
                <TableHead key={t.id} className="min-w-[120px] text-center">{t.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {nonAdminUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium sticky left-0 bg-background z-10">
                  {user.name}
                </TableCell>
                {nonArchivedTables.map((table) => (
                  <TableCell key={table.id} className="text-center">
                    <Select
                      value={getAccess(table.id, user.id)}
                      onValueChange={(v) => void handleChange(table.id, user.id, v)}
                    >
                      <SelectTrigger className="h-7 w-20 text-xs mx-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="edit">Edit</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
