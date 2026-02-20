"use client"

import React, { useState } from "react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import type { User, Role } from "@/lib/types"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Plus, UserPlus, Trash2, RefreshCw } from "lucide-react"

export function AdminUsersTab() {
  const { users, addUser, updateUser, deleteUser, leads } = useStore()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("sales")

  const handleInvite = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required")
      return
    }

    const newUser: User = {
      id: "",
      name: name.trim(),
      email: email.trim(),
      role,
    }
    try {
      await addUser(newUser)
      toast.success(`Invited ${newUser.name}`)
      setName("")
      setEmail("")
      setRole("sales")
      setInviteOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to invite user"
      toast.error(message)
    }
  }

  const getLeadCount = (userId: string) =>
    leads.filter((l) => l.ownerId === userId && !l.isArchived).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} users</p>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" />
          Invite user
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs capitalize">{user.role}</Badge>
                </TableCell>
                <TableCell className="text-right text-sm">{getLeadCount(user.id)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          void (async () => {
                            try {
                              await updateUser(user.id, {
                                role: user.role === "admin" ? "sales" : "admin",
                              })
                              toast.success(
                                `${user.name} is now ${user.role === "admin" ? "sales" : "admin"}`,
                              )
                            } catch (error) {
                              const message =
                                error instanceof Error
                                  ? error.message
                                  : "Failed to update user role"
                              toast.error(message)
                            }
                          })()
                        }}
                      >
                        <RefreshCw className="mr-2 h-3.5 w-3.5" />
                        Toggle role
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete user
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the user. Their leads will need to be reassigned.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                              void (async () => {
                                try {
                                  await deleteUser(user.id)
                                  toast.success(`Deleted ${user.name}`)
                                } catch (error) {
                                  const message =
                                    error instanceof Error ? error.message : "Failed to delete user"
                                  toast.error(message)
                                }
                              })()
                            }}>
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

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>Add a new user to the organization.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleInvite()}>Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
