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
import { cn } from "@/lib/utils"

interface LeadDetailDrawerProps {
  leadId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
}

type LeadDraft = Pick<
  Lead,
  | "stage"
  | "ownerId"
  | "nextFollowUpAt"
  | "followUpWindow"
  | "contact"
  | "sourceType"
  | "sourceDetail"
  | "interestedServices"
  | "doNotContact"
  | "dncReason"
  | "lostReason"
  | "websiteUrl"
  | "notes"
>

const toLeadDraft = (lead: Lead): LeadDraft => ({
  stage: lead.stage,
  ownerId: lead.ownerId,
  nextFollowUpAt: lead.nextFollowUpAt,
  followUpWindow: lead.followUpWindow,
  contact: lead.contact,
  sourceType: lead.sourceType,
  sourceDetail: lead.sourceDetail,
  interestedServices: [...lead.interestedServices],
  doNotContact: lead.doNotContact,
  dncReason: lead.dncReason,
  lostReason: lead.lostReason,
  websiteUrl: lead.websiteUrl,
  notes: lead.notes,
})

const toDateInputValue = (value: string | null) => {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return format(parsed, "yyyy-MM-dd")
}

const sameStringList = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false
  const leftSorted = [...left].sort()
  const rightSorted = [...right].sort()
  return leftSorted.every((value, index) => value === rightSorted[index])
}

export function LeadDetailDrawer({ leadId, open, onOpenChange, tableId }: LeadDetailDrawerProps) {
  const {
    leads,
    saveLead,
    archiveLead,
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
  const canWrite = canEdit || isAdmin
  const [historyOpen, setHistoryOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [draft, setDraft] = useState<LeadDraft | null>(null)
  const initializedLeadIdRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open || !leadId) return
    void loadLeadArtifacts(leadId)
  }, [leadId, loadLeadArtifacts, open])

  useEffect(() => {
    if (!open) {
      initializedLeadIdRef.current = null
      setDraft(null)
      return
    }

    if (!lead || !leadId) return

    if (initializedLeadIdRef.current !== leadId) {
      setDraft(toLeadDraft(lead))
      initializedLeadIdRef.current = leadId
    }
  }, [open, leadId, lead])

  if (!lead || !draft) return null

  const daysSinceStageChange = lead.stageChangedAt
    ? formatDistanceToNow(new Date(lead.stageChangedAt), { addSuffix: false })
    : "unknown"

  const normalizedDraftContact = draft.contact.trim()
  const normalizedDraftWebsite = draft.websiteUrl.trim()
  const normalizedDraftFollowUp = draft.nextFollowUpAt
    ? toDateInputValue(draft.nextFollowUpAt)
    : null

  const hasUnsavedChanges =
    lead.stage !== draft.stage ||
    lead.ownerId !== draft.ownerId ||
    toDateInputValue(lead.nextFollowUpAt) !== normalizedDraftFollowUp ||
    lead.followUpWindow !== draft.followUpWindow ||
    lead.contact !== normalizedDraftContact ||
    lead.sourceType !== draft.sourceType ||
    lead.sourceDetail !== draft.sourceDetail ||
    !sameStringList(lead.interestedServices, draft.interestedServices) ||
    lead.doNotContact !== draft.doNotContact ||
    lead.dncReason !== draft.dncReason ||
    lead.lostReason !== draft.lostReason ||
    lead.websiteUrl !== normalizedDraftWebsite ||
    lead.notes !== draft.notes

  const handleSave = async () => {
    if (!canWrite || !hasUnsavedChanges || isSaving) return

    if (draft.stage === "Contacted") {
      const missing: string[] = []
      if (!normalizedDraftContact) missing.push("contact")
      if (!normalizedDraftFollowUp) missing.push("next follow-up")

      if (missing.length > 0) {
        toast.error(`Contacted stage requires ${missing.join(" and ")}`)
        return
      }
    }

    const updates: Partial<Lead> = {}

    if (lead.stage !== draft.stage) {
      updates.stage = draft.stage
      updates.stageChangedAt = new Date().toISOString()
    }
    if (lead.ownerId !== draft.ownerId) updates.ownerId = draft.ownerId
    if (toDateInputValue(lead.nextFollowUpAt) !== normalizedDraftFollowUp) {
      updates.nextFollowUpAt = normalizedDraftFollowUp
    }
    if (lead.followUpWindow !== draft.followUpWindow) updates.followUpWindow = draft.followUpWindow
    if (lead.contact !== normalizedDraftContact) updates.contact = normalizedDraftContact
    if (lead.sourceType !== draft.sourceType) updates.sourceType = draft.sourceType
    if (lead.sourceDetail !== draft.sourceDetail) updates.sourceDetail = draft.sourceDetail
    if (!sameStringList(lead.interestedServices, draft.interestedServices)) {
      updates.interestedServices = draft.interestedServices
    }
    if (lead.doNotContact !== draft.doNotContact) updates.doNotContact = draft.doNotContact
    if (lead.dncReason !== draft.dncReason) updates.dncReason = draft.dncReason
    if (lead.lostReason !== draft.lostReason) updates.lostReason = draft.lostReason
    if (lead.websiteUrl !== normalizedDraftWebsite) updates.websiteUrl = normalizedDraftWebsite
    if (lead.notes !== draft.notes) updates.notes = draft.notes

    if (Object.keys(updates).length === 0) return

    try {
      setIsSaving(true)
      await saveLead(lead.id, updates)
      toast.success("Lead saved")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save lead"
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
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

  const handleDeleteLead = async () => {
    if (!canWrite || isDeleting) return

    try {
      setIsDeleting(true)
      await archiveLead(lead.id)
      toast.success("Lead deleted")
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete lead"
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  // Parse contact for action buttons
  const hasEmail = draft.contact.includes("@") && !draft.contact.startsWith("@")
  const hasPhone = /\+?\d[\d\s-]{6,}/.test(draft.contact)
  const hasIG = draft.contact.startsWith("@") || draft.contact.includes("instagram")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg truncate">{lead.businessName}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StageBadge stage={draft.stage} />
                  {draft.doNotContact && (
                    <Badge variant="destructive" className="text-xs">DNC</Badge>
                  )}
                  {lead.isArchived && (
                    <Badge variant="secondary" className="text-xs">Archived</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {daysSinceStageChange} in {draft.stage}
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
                    const handle = draft.contact.replace("@", "")
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
                      window.open(`https://wa.me/${draft.contact.replace(/\D/g, "")}`, "_blank")
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
                      window.open(`tel:${draft.contact}`, "_blank")
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
                    window.open(`mailto:${draft.contact}`, "_blank")
                    void appendNote("Email sent")
                  }}
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </Button>
              )}
              {draft.websiteUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  asChild
                >
                  <a href={draft.websiteUrl} target="_blank" rel="noopener noreferrer">
                    <Globe className="h-3.5 w-3.5" /> Website
                  </a>
                </Button>
              )}
              {draft.contact && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => copyToClipboard(draft.contact)}
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
                  value={draft.stage}
                  onValueChange={(v) =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            stage: v as Stage,
                          }
                        : prev,
                    )
                  }
                  disabled={!canWrite}
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
                  value={draft.ownerId ?? "unassigned"}
                  onValueChange={(v) =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            ownerId: v === "unassigned" ? null : v,
                          }
                        : prev,
                    )
                  }
                  disabled={!canWrite}
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
                  value={toDateInputValue(draft.nextFollowUpAt)}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            nextFollowUpAt: e.target.value || null,
                          }
                        : prev,
                    )
                  }
                  disabled={!canWrite}
                />
              </div>

              {/* Follow-up window */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Follow-up window</Label>
                <Select
                  value={draft.followUpWindow}
                  onValueChange={(v) =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            followUpWindow: v as FollowUpWindow,
                          }
                        : prev,
                    )
                  }
                  disabled={!canWrite}
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
                  value={draft.contact}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            contact: e.target.value,
                          }
                        : prev,
                    )
                  }
                  disabled={!canWrite}
                  placeholder="Phone, email, or IG handle"
                />
              </div>

              {/* Source */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Source type</Label>
                  <Select
                    value={draft.sourceType}
                    onValueChange={(v) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              sourceType: v as SourceType,
                            }
                          : prev,
                      )
                    }
                    disabled={!canWrite}
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
                    value={draft.sourceDetail}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              sourceDetail: e.target.value,
                            }
                          : prev,
                      )
                    }
                    disabled={!canWrite}
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Interested services */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Interested services</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tableServices.map((s) => {
                    const selected = draft.interestedServices.includes(s.id)
                    return (
                      <Badge
                        key={s.id}
                        variant={selected ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer text-xs transition-colors",
                          !canWrite && "pointer-events-none opacity-60"
                        )}
                        onClick={() => {
                          if (!canWrite) return
                          const updated = selected
                            ? draft.interestedServices.filter((id) => id !== s.id)
                            : [...draft.interestedServices, s.id]
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  interestedServices: updated,
                                }
                              : prev,
                          )
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
                  checked={draft.doNotContact}
                  onCheckedChange={(checked) =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            doNotContact: checked,
                          }
                        : prev,
                    )
                  }
                  disabled={!canWrite}
                />
              </div>

              {draft.doNotContact && (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">DNC reason</Label>
                  <Input
                    className="h-8 text-sm"
                    value={draft.dncReason}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              dncReason: e.target.value,
                            }
                          : prev,
                      )
                    }
                    disabled={!canWrite}
                  />
                </div>
              )}

              {/* Lost reason */}
              {draft.stage === "Lost" && (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Lost reason</Label>
                  <Input
                    className="h-8 text-sm"
                    value={draft.lostReason}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              lostReason: e.target.value,
                            }
                          : prev,
                      )
                    }
                    disabled={!canWrite}
                  />
                </div>
              )}

              {/* Website URL */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Website URL</Label>
                <Input
                  className="h-8 text-sm"
                  value={draft.websiteUrl}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            websiteUrl: e.target.value,
                          }
                        : prev,
                    )
                  }
                  disabled={!canWrite}
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
                value={draft.notes}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          notes: e.target.value,
                        }
                      : prev,
                  )
                }
                disabled={!canWrite}
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
                    disabled={!canWrite}
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
        {canWrite && (
          <div className="border-t p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {!lead.isArchived ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto" disabled={isDeleting}>
                      {isDeleting ? "Deleting..." : "Delete lead"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will move the lead to archived and remove it from active views.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void handleDeleteLead()}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              <Button
                className="w-full sm:w-auto"
                onClick={() => void handleSave()}
                disabled={!hasUnsavedChanges || isSaving}
              >
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
