"use client"

import React, { useEffect, useRef, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import {
  Clock,
  Copy,
  Globe,
  Instagram,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import type { Lead, Stage, FollowUpWindow, SourceType } from "@/lib/types"
import { STAGES, SOURCE_TYPES, FOLLOW_UP_WINDOWS } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StageBadge } from "@/components/stage-badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface LeadDetailDrawerProps {
  leadId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
}

export function LeadDetailDrawer({ leadId, open, onOpenChange, tableId }: LeadDetailDrawerProps) {
  const {
    leads,
    updateLead,
    currentUser,
    allUsers,
    services,
    events,
    attachments,
    getAccess,
    loadLeadArtifacts,
    uploadAttachment,
    logTouchLead,
  } = useStore()
  const lead = leads.find((l) => l.id === leadId)
  const tableServices = services.filter((s) => s.tableId === tableId && !s.isArchived)
  const leadEvents = events.filter((e) => e.leadId === leadId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  const leadAttachments = attachments.filter((a) => a.leadId === leadId)
  const access = getAccess(tableId)
  const canEdit = access === "edit"
  const isAdmin = currentUser.role === "admin"
  const [historyOpen, setHistoryOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open || !leadId) return
    void loadLeadArtifacts(leadId)
  }, [leadId, loadLeadArtifacts, open])

  if (!lead) return null

  const daysSinceStageChange = lead.stageChangedAt
    ? formatDistanceToNow(new Date(lead.stageChangedAt), { addSuffix: false })
    : "unknown"

  const handleUpdate = (updates: Partial<Lead>) => {
    if (!canEdit && !isAdmin) return
    updateLead(lead.id, updates)
    toast.success("Lead updated")
  }

  const appendNote = async (text: string) => {
    try {
      await logTouchLead(lead.id, text)
      toast.success("Touch logged")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to log touch"
      toast.error(message)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  // Parse contact for action buttons
  const hasEmail = lead.contact.includes("@") && !lead.contact.startsWith("@")
  const hasPhone = /\+?\d[\d\s-]{6,}/.test(lead.contact)
  const hasIG = lead.contact.startsWith("@") || lead.contact.includes("instagram")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg truncate">{lead.businessName}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StageBadge stage={lead.stage} />
                  {lead.doNotContact && (
                    <Badge variant="destructive" className="text-xs">DNC</Badge>
                  )}
                  {lead.isArchived && (
                    <Badge variant="secondary" className="text-xs">Archived</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {daysSinceStageChange} in {lead.stage}
                  </span>
                </div>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-6 pt-4">
          <div className="flex flex-col gap-6">
            {/* Contact actions */}
            <div className="flex flex-wrap gap-2">
              {hasIG && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    const handle = lead.contact.replace("@", "")
                    window.open(`https://instagram.com/${handle}`, "_blank")
                    void appendNote("IG DM sent")
                  }}
                >
                  <Instagram className="h-3.5 w-3.5" /> Instagram
                </Button>
              )}
              {hasPhone && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      window.open(`https://wa.me/${lead.contact.replace(/\D/g, "")}`, "_blank")
                      void appendNote("WhatsApp sent")
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      window.open(`tel:${lead.contact}`, "_blank")
                      void appendNote("Called")
                    }}
                  >
                    <Phone className="h-3.5 w-3.5" /> Call
                  </Button>
                </>
              )}
              {hasEmail && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    window.open(`mailto:${lead.contact}`, "_blank")
                    void appendNote("Email sent")
                  }}
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </Button>
              )}
              {lead.websiteUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  asChild
                >
                  <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer">
                    <Globe className="h-3.5 w-3.5" /> Website
                  </a>
                </Button>
              )}
              {lead.contact && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => copyToClipboard(lead.contact)}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy contact
                </Button>
              )}
            </div>

            <Separator />

            {/* Editable fields */}
            <div className="grid gap-4">
              {/* Stage */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Stage</Label>
                <Select
                  value={lead.stage}
                  onValueChange={(v) => handleUpdate({
                    stage: v as Stage,
                    stageChangedAt: new Date().toISOString(),
                  })}
                  disabled={!canEdit && !isAdmin}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Owner */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Owner</Label>
                <Select
                  value={lead.ownerId ?? "unassigned"}
                  onValueChange={(v) => handleUpdate({ ownerId: v === "unassigned" ? null : v })}
                  disabled={!canEdit && !isAdmin}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Follow-up date */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Next follow-up</Label>
                <Input
                  type="date"
                  className="h-8 text-sm"
                  value={lead.nextFollowUpAt ? format(new Date(lead.nextFollowUpAt), "yyyy-MM-dd") : ""}
                  onChange={(e) => handleUpdate({ nextFollowUpAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  disabled={!canEdit && !isAdmin}
                />
              </div>

              {/* Follow-up window */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Follow-up window</Label>
                <Select
                  value={lead.followUpWindow}
                  onValueChange={(v) => handleUpdate({ followUpWindow: v as FollowUpWindow })}
                  disabled={!canEdit && !isAdmin}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_WINDOWS.map((w) => (
                      <SelectItem key={w} value={w}>{w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contact */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Contact</Label>
                <Input
                  className="h-8 text-sm"
                  value={lead.contact}
                  onChange={(e) => handleUpdate({ contact: e.target.value.trim() })}
                  disabled={!canEdit && !isAdmin}
                  placeholder="Phone, email, or IG handle"
                />
              </div>

              {/* Source */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Source type</Label>
                  <Select
                    value={lead.sourceType}
                    onValueChange={(v) => handleUpdate({ sourceType: v as SourceType })}
                    disabled={!canEdit && !isAdmin}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_TYPES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Source detail</Label>
                  <Input
                    className="h-8 text-sm"
                    value={lead.sourceDetail}
                    onChange={(e) => handleUpdate({ sourceDetail: e.target.value })}
                    disabled={!canEdit && !isAdmin}
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Interested services */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Interested services</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tableServices.map((s) => {
                    const selected = lead.interestedServices.includes(s.id)
                    return (
                      <Badge
                        key={s.id}
                        variant={selected ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer text-xs transition-colors",
                          !canEdit && !isAdmin && "pointer-events-none opacity-60"
                        )}
                        onClick={() => {
                          if (!canEdit && !isAdmin) return
                          const updated = selected
                            ? lead.interestedServices.filter((id) => id !== s.id)
                            : [...lead.interestedServices, s.id]
                          handleUpdate({ interestedServices: updated })
                        }}
                      >
                        {s.name}
                      </Badge>
                    )
                  })}
                  {tableServices.length === 0 && (
                    <span className="text-xs text-muted-foreground">No services configured</span>
                  )}
                </div>
              </div>

              {/* DNC */}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Do Not Contact</Label>
                  <p className="text-xs text-muted-foreground">Lead will be hidden from active lists</p>
                </div>
                <Switch
                  checked={lead.doNotContact}
                  onCheckedChange={(checked) => handleUpdate({ doNotContact: checked })}
                  disabled={!canEdit && !isAdmin}
                />
              </div>

              {lead.doNotContact && (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">DNC reason</Label>
                  <Input
                    className="h-8 text-sm"
                    value={lead.dncReason}
                    onChange={(e) => handleUpdate({ dncReason: e.target.value })}
                    disabled={!canEdit && !isAdmin}
                  />
                </div>
              )}

              {/* Lost reason */}
              {lead.stage === "Lost" && (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Lost reason</Label>
                  <Input
                    className="h-8 text-sm"
                    value={lead.lostReason}
                    onChange={(e) => handleUpdate({ lostReason: e.target.value })}
                    disabled={!canEdit && !isAdmin}
                  />
                </div>
              )}

              {/* Website URL */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Website URL</Label>
                <Input
                  className="h-8 text-sm"
                  value={lead.websiteUrl}
                  onChange={(e) => handleUpdate({ websiteUrl: e.target.value.trim() })}
                  disabled={!canEdit && !isAdmin}
                  placeholder="https://..."
                />
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea
                className="min-h-[100px] text-sm"
                value={lead.notes}
                onChange={(e) => handleUpdate({ notes: e.target.value })}
                disabled={!canEdit && !isAdmin}
                placeholder="Add notes..."
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  "IG DM sent",
                  "WhatsApp sent",
                  "Email sent",
                  "Called - no answer",
                  "Called - spoke",
                  "Replied - asked price",
                ].map((chip) => (
                  <Button
                    key={chip}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => void appendNote(chip)}
                    disabled={!canEdit && !isAdmin}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {chip}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Attachments */}
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">Attachments</Label>
              {leadAttachments.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {leadAttachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded border p-2 text-xs">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{a.filename}</span>
                      <span className="text-muted-foreground">{format(new Date(a.createdAt), "MMM d")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No attachments</p>
              )}
              {(canEdit || isAdmin) && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file || !leadId) return
                      void (async () => {
                        try {
                          await uploadAttachment(leadId, file)
                          toast.success("Attachment uploaded")
                        } catch (error) {
                          const message = error instanceof Error ? error.message : "Upload failed"
                          toast.error(message)
                        } finally {
                          event.target.value = ""
                        }
                      })()
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit text-xs gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                  <Plus className="h-3.5 w-3.5" />
                  Upload file
                  </Button>
                </>
              )}
            </div>

            <Separator />

            {/* History */}
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full hover:underline">
                <Clock className="h-4 w-4" />
                History ({leadEvents.length} events)
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                {leadEvents.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {leadEvents.map((ev) => {
                      const user = allUsers.find((u) => u.id === ev.byUser)
                      return (
                        <div key={ev.id} className="flex gap-3 text-xs">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground">
                              <span className="font-medium">{user?.name ?? "System"}</span>{" "}
                              {ev.type === "stage_change" && `changed stage: ${ev.meta.from} → ${ev.meta.to}`}
                              {ev.type === "owner_change" && "changed owner"}
                              {ev.type === "dnc_change" && `set DNC: ${ev.meta.value}`}
                              {ev.type === "touch_logged" && `logged: ${ev.meta.note}`}
                              {ev.type === "follow_up_change" && "updated follow-up"}
                              {ev.type === "services_change" && "updated services"}
                              {ev.type === "import" && "imported lead"}
                              {ev.type === "note_added" && "added note"}
                              {ev.type === "merge" && "merged lead"}
                            </p>
                            <p className="text-muted-foreground">
                              {format(new Date(ev.createdAt), "MMM d, yyyy HH:mm")}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No history yet</p>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
