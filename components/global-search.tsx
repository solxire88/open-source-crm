"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { apiFetch } from "@/lib/api/client"

interface GlobalSearchProps {
  onSelectLead?: (leadId: string) => void
}

interface SearchResultLead {
  id: string
  table_id: string
  business_name: string
  domain: string | null
  contact: string | null
  notes: string | null
  stage: string
  owner_id: string | null
  updated_at: string
}

interface SearchResultGroup {
  table_id: string
  table_name: string
  items: SearchResultLead[]
}

export function GlobalSearch({ onSelectLead }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [groups, setGroups] = useState<SearchResultGroup[]>([])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  useEffect(() => {
    if (!open) return

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setGroups([])
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await apiFetch<{
          tables: SearchResultGroup[]
        }>(`/api/search?q=${encodeURIComponent(trimmed)}&limit=60&offset=0`)
        setGroups(response.tables ?? [])
      } catch (error) {
        console.error(error)
        setGroups([])
      } finally {
        setIsLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [open, query])

  const hasResults = useMemo(
    () => groups.some((group) => group.items.length > 0),
    [groups],
  )

  return (
    <>
      <Button
        variant="outline"
        className="relative h-8 w-full max-w-sm justify-start text-sm text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span>Search leads...</span>
        <kbd className="pointer-events-none absolute right-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search across permitted tables..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">Searching...</div>
          ) : null}
          {!isLoading && !hasResults ? (
            <CommandEmpty>
              {query.trim().length < 2 ? "Type at least 2 characters." : "No leads found."}
            </CommandEmpty>
          ) : null}
          {groups.map((group) => (
            <CommandGroup key={group.table_id} heading={group.table_name}>
              {group.items.map((lead) => (
                <CommandItem
                  key={lead.id}
                  value={`${lead.business_name} ${lead.contact ?? ""} ${lead.notes ?? ""}`}
                  onSelect={() => {
                    setOpen(false)
                    if (onSelectLead) onSelectLead(lead.id)
                    window.location.href = `/tables/${lead.table_id}?lead=${lead.id}`
                  }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{lead.business_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {lead.contact || "No contact"}
                      {lead.updated_at
                        ? ` · Updated ${format(new Date(lead.updated_at), "MMM d")}`
                        : ""}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {lead.stage}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}

