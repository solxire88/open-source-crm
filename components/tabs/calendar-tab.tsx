"use client"

import React, { useMemo, useState } from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  getDay,
} from "date-fns"
import { useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface CalendarTabProps {
  tableId: string
  onSelectLead: (id: string) => void
}

export function CalendarTab({ tableId, onSelectLead }: CalendarTabProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const { leads } = useStore()

  const tableLeads = useMemo(
    () =>
      leads.filter(
        (l) =>
          l.tableId === tableId &&
          l.nextFollowUpAt &&
          !l.isArchived
      ),
    [leads, tableId]
  )

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Pad start of month
  const startDayOfWeek = getDay(monthStart)
  const paddingDays = Array.from({ length: startDayOfWeek }, (_, i) => null)

  const getLeadsForDay = (day: Date) =>
    tableLeads.filter((l) => isSameDay(new Date(l.nextFollowUpAt!), day))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{format(currentMonth, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-lg border bg-border overflow-hidden">
        {/* Day headers */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {/* Padding */}
        {paddingDays.map((_, i) => (
          <div key={`pad-${i}`} className="bg-background min-h-[80px] p-1" />
        ))}

        {/* Days */}
        {days.map((day) => {
          const dayLeads = getLeadsForDay(day)
          const isToday = isSameDay(day, new Date())

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "bg-background min-h-[80px] p-1 flex flex-col",
                isToday && "bg-accent/50"
              )}
            >
              <span
                className={cn(
                  "text-xs mb-1 px-1",
                  isToday && "font-bold text-foreground",
                  !isToday && "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayLeads.slice(0, 3).map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => onSelectLead(lead.id)}
                    className={cn(
                      "truncate rounded px-1.5 py-0.5 text-[10px] text-left transition-colors",
                      lead.doNotContact
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    {lead.businessName}
                  </button>
                ))}
                {dayLeads.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{dayLeads.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
