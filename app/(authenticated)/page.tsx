"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { Star, Search, AlertCircle } from "lucide-react"
import { useStore } from "@/lib/store"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function HomePage() {
  const [search, setSearch] = useState("")
  const { currentUser, getPermittedTables, leads, favorites, toggleFavorite, isBootstrapping } = useStore()

  const permittedTables = getPermittedTables()
  const filtered = useMemo(() => {
    if (!search.trim()) return permittedTables
    return permittedTables.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [permittedTables, search])

  const getTableStats = (tableId: string) => {
    const tableLeads = leads.filter((l) => l.tableId === tableId && !l.isArchived)
    const newCount = tableLeads.filter((l) => l.stage === "New").length
    const overdueCount = tableLeads.filter((l) => {
      if (!l.nextFollowUpAt || l.doNotContact) return false
      if (l.stage === "Won" || l.stage === "Lost") return false
      return new Date(l.nextFollowUpAt) <= new Date()
    }).length
    return { total: tableLeads.length, newCount, overdueCount }
  }

  if (isBootstrapping) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    )
  }

  if (permittedTables.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No tables available</h2>
          <p className="text-sm text-muted-foreground">
            {currentUser.role === "admin"
              ? "Create a table in the Admin panel to get started."
              : "Ask your admin for access to tables."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tables</h1>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((table) => {
          const stats = getTableStats(table.id)
          const isFav = favorites.includes(table.id)

          return (
            <Link key={table.id} href={`/tables/${table.id}`}>
              <Card className="group relative transition-colors hover:border-foreground/20 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-medium">{table.name}</CardTitle>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        void toggleFavorite(table.id)
                      }}
                      className={cn(
                        "transition-opacity",
                        isFav
                          ? "text-yellow-500 opacity-100"
                          : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-500"
                      )}
                    >
                      <Star className="h-4 w-4" fill={isFav ? "currentColor" : "none"} />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {stats.total} leads
                    </Badge>
                    {stats.newCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {stats.newCount} new
                      </Badge>
                    )}
                    {stats.overdueCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {stats.overdueCount} overdue
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
