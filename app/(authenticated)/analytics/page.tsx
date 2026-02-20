"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useStore } from "@/lib/store"
import { apiFetch } from "@/lib/api/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { AlertTriangle, Clock, Search, ShieldOff, Trophy } from "lucide-react"

const TIME_RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const

interface AnalyticsSnapshot {
  leaderboard: {
    wins_by_owner: Array<{ owner_id: string | null; wins: number }>
    win_rate: Array<{ owner_id: string | null; won: number; closed: number; win_rate: number }>
    overdue_followups_by_owner: Array<{ owner_id: string | null; overdue: number }>
  }
  pipeline_counts_by_stage_per_owner: Array<{ owner_id: string | null; stage: string; count: number }>
  source_performance: Array<{
    source_type: string
    source_detail: string | null
    total: number
    won: number
    lost: number
    win_rate: number
  }>
  services_performance: Array<{
    service_id: string
    service_name: string
    total: number
    won: number
    lost: number
    win_rate: number
  }>
  health_widgets: {
    contacted_missing_followup: number
    overdue_count: number
    missing_source_count: number
    dnc_count: number
  }
}

export default function AnalyticsPage() {
  const { currentUser, getPermittedTables, allUsers } = useStore()
  const isAdmin = currentUser.role === "admin"
  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGES)[number]["value"]>("30d")
  const [selectedTableId, setSelectedTableId] = useState<string>("all")
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const permittedTables = getPermittedTables()

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("range", timeRange)
        if (isAdmin && selectedTableId !== "all") {
          params.set("tableIds", selectedTableId)
        }

        const response = await apiFetch<{
          data: AnalyticsSnapshot
        }>(`/api/analytics?${params.toString()}`)

        if (!cancelled) {
          setSnapshot(response.data)
        }
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setSnapshot(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [isAdmin, selectedTableId, timeRange])

  const leaderboard = useMemo(() => {
    if (!snapshot) return []

    const winsMap = new Map(
      snapshot.leaderboard.wins_by_owner.map((row) => [row.owner_id ?? "unassigned", row.wins]),
    )
    const rateMap = new Map(
      snapshot.leaderboard.win_rate.map((row) => [row.owner_id ?? "unassigned", row.win_rate]),
    )
    const overdueMap = new Map(
      snapshot.leaderboard.overdue_followups_by_owner.map((row) => [
        row.owner_id ?? "unassigned",
        row.overdue,
      ]),
    )

    const ownerIds = new Set<string>([
      ...winsMap.keys(),
      ...rateMap.keys(),
      ...overdueMap.keys(),
    ])

    return Array.from(ownerIds)
      .map((ownerId) => {
        const owner = allUsers.find((user) => user.id === ownerId)
        return {
          ownerId,
          ownerName: owner?.name ?? (ownerId === "unassigned" ? "Unassigned" : ownerId),
          wins: winsMap.get(ownerId) ?? 0,
          winRate: Math.round(rateMap.get(ownerId) ?? 0),
          overdue: overdueMap.get(ownerId) ?? 0,
        }
      })
      .sort((a, b) => b.wins - a.wins)
  }, [allUsers, snapshot])

  const sourceData = useMemo(() => {
    if (!snapshot) return []
    return snapshot.source_performance.map((row) => ({
      source: row.source_type,
      leads: row.total,
      won: row.won,
    }))
  }, [snapshot])

  const servicesData = useMemo(() => {
    if (!snapshot) return []
    return snapshot.services_performance.map((row) => ({
      name: row.service_name,
      requests: row.total,
      won: row.won,
      winRate: Math.round(row.win_rate),
    }))
  }, [snapshot])

  const health = useMemo(
    () => ({
      overdue: snapshot?.health_widgets.overdue_count ?? 0,
      missingSource: snapshot?.health_widgets.missing_source_count ?? 0,
      dncCount: snapshot?.health_widgets.dnc_count ?? 0,
      contactedNoFollowup: snapshot?.health_widgets.contacted_missing_followup ?? 0,
    }),
    [snapshot],
  )

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
              <SelectTrigger className="h-8 w-44 text-sm">
                <SelectValue placeholder="All tables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tables</SelectItem>
                {permittedTables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as (typeof TIME_RANGES)[number]["value"])}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HealthCard
              icon={Clock}
              label="Overdue Follow-ups"
              value={health.overdue}
              variant={health.overdue > 0 ? "warning" : "success"}
            />
            <HealthCard
              icon={Search}
              label="Missing Source"
              value={health.missingSource}
              variant={health.missingSource > 0 ? "warning" : "success"}
            />
            <HealthCard
              icon={ShieldOff}
              label="DNC Leads"
              value={health.dncCount}
              variant="neutral"
            />
            <HealthCard
              icon={AlertTriangle}
              label="Contacted w/o Follow-up"
              value={health.contactedNoFollowup}
              variant={health.contactedNoFollowup > 0 ? "warning" : "success"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Leaderboard
                </CardTitle>
                <CardDescription>Wins, win rate, and overdue follow-ups by owner</CardDescription>
              </CardHeader>
              <CardContent>
                {leaderboard.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Owner</TableHead>
                        <TableHead className="text-right">Wins</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">Overdue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.map((row) => (
                        <TableRow key={row.ownerId}>
                          <TableCell className="font-medium">{row.ownerName}</TableCell>
                          <TableCell className="text-right">{row.wins}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="text-xs">
                              {row.winRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.overdue > 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                {row.overdue}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No data</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Source Performance</CardTitle>
                <CardDescription>Leads and wins by source type</CardDescription>
              </CardHeader>
              <CardContent>
                {sourceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={sourceData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="source" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          fontSize: 12,
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Bar dataKey="leads" name="Total Leads" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="won" name="Won" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No data</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Services Performance</CardTitle>
                <CardDescription>Top requested services and win rate</CardDescription>
              </CardHeader>
              <CardContent>
                {servicesData.length > 0 ? (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={servicesData.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "var(--radius)",
                            fontSize: 12,
                            color: "hsl(var(--card-foreground))",
                          }}
                        />
                        <Bar dataKey="requests" name="Requests" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead className="text-right">Requests</TableHead>
                          <TableHead className="text-right">Won</TableHead>
                          <TableHead className="text-right">Win Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {servicesData.slice(0, 8).map((row) => (
                          <TableRow key={row.name}>
                            <TableCell className="font-medium text-sm">{row.name}</TableCell>
                            <TableCell className="text-right text-sm">{row.requests}</TableCell>
                            <TableCell className="text-right text-sm">{row.won}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary" className="text-xs">
                                {row.winRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No data</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function HealthCard({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  variant: "warning" | "success" | "neutral"
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={
            variant === "warning"
              ? "flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : variant === "success"
              ? "flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          }
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

