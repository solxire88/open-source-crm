"use client"

import { Badge } from "@/components/ui/badge"
import type { Stage } from "@/lib/types"
import { cn } from "@/lib/utils"

const stageColors: Record<Stage, string> = {
  New: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Contacted: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Replied: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  Meeting: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  Proposal: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Lost: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-0 font-medium", stageColors[stage], className)}
    >
      {stage}
    </Badge>
  )
}
