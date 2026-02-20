"use client"

import React, { useState } from "react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import type { Stage, SourceType, FollowUpWindow, Lead } from "@/lib/types"
import { STAGES, SOURCE_TYPES, FOLLOW_UP_WINDOWS } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface AddLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
}

export function AddLeadDialog({ open, onOpenChange, tableId }: AddLeadDialogProps) {
  const { addLead, tables, services, currentUser } = useStore()
  const table = tables.find((t) => t.id === tableId)
  const tableServices = services.filter((s) => s.tableId === tableId && !s.isArchived)

  const [businessName, setBusinessName] = useState("")
  const [contact, setContact] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [sourceType, setSourceType] = useState<SourceType>(
    table?.defaults.defaultSourceType ?? "Unknown"
  )
  const [sourceDetail, setSourceDetail] = useState("")
  const [stage, setStage] = useState<Stage>(table?.defaults.defaultStage ?? "New")
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const reset = () => {
    setBusinessName("")
    setContact("")
    setWebsiteUrl("")
    setNotes("")
    setSourceType(table?.defaults.defaultSourceType ?? "Unknown")
    setSourceDetail("")
    setStage(table?.defaults.defaultStage ?? "New")
    setSelectedServices([])
    setErrors({})
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!businessName.trim()) errs.businessName = "Business name is required"
    if (stage === "Contacted") {
      if (!contact.trim()) errs.contact = "Contact is required when stage is Contacted"
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    const now = new Date().toISOString()
    const newLead: Lead = {
      id: "",
      tableId,
      businessName: businessName.trim(),
      stage,
      ownerId: stage === "New" ? null : currentUser.id,
      nextFollowUpAt: null,
      followUpWindow: "Anytime",
      contact: contact.trim(),
      websiteUrl: websiteUrl.trim(),
      notes: notes.trim(),
      sourceType,
      sourceDetail: sourceDetail.trim(),
      interestedServices: selectedServices,
      lastTouchedAt: now,
      doNotContact: false,
      dncReason: "",
      lostReason: "",
      isArchived: false,
      stageChangedAt: now,
      createdAt: now,
    }

    try {
      await addLead(newLead)
      toast.success("Lead added successfully")
      reset()
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add lead"
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Add a new lead to {table?.name ?? "this table"}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="businessName">Business name *</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Acme Corp"
            />
            {errors.businessName && (
              <p className="text-xs text-destructive">{errors.businessName}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Source type</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="contact">Contact</Label>
            <Input
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone, email, or IG handle"
            />
            {errors.contact && (
              <p className="text-xs text-destructive">{errors.contact}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="website">Website URL</Label>
            <Input
              id="website"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sourceDetail">Source detail</Label>
            <Input
              id="sourceDetail"
              value={sourceDetail}
              onChange={(e) => setSourceDetail(e.target.value)}
              placeholder="Optional detail"
            />
          </div>

          {tableServices.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Interested services</Label>
              <div className="flex flex-wrap gap-1.5">
                {tableServices.map((s) => {
                  const selected = selectedServices.includes(s.id)
                  return (
                    <Badge
                      key={s.id}
                      variant={selected ? "default" : "outline"}
                      className="cursor-pointer text-xs transition-colors"
                      onClick={() =>
                        setSelectedServices((prev) =>
                          selected ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                        )
                      }
                    >
                      {s.name}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes..."
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()}>Add Lead</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
