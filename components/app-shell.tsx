"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Home,
  Settings,
  Star,
  Table2,
  Sun,
  Moon,
  Monitor,
  LogOut,
  ChevronDown,
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { GlobalSearch } from "@/components/global-search"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { currentUser, org, getPermittedTables, favorites, toggleFavorite, logout } = useStore()
  const { setTheme, theme } = useTheme()

  const permittedTables = getPermittedTables()
  const favoriteTables = permittedTables.filter((t) => favorites.includes(t.id))
  const otherTables = permittedTables.filter((t) => !favorites.includes(t.id))

  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r bg-sidebar transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center border-b px-4">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2 overflow-hidden">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="h-7 w-7 rounded object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
                  {org.name.charAt(0)}
                </div>
              )}
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                {org.name}
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/" className="mx-auto">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
                {org.name.charAt(0)}
              </div>
            </Link>
          )}
        </div>

        <ScrollArea className="flex-1 py-2">
          {/* Home */}
          <SidebarLink
            href="/"
            icon={Home}
            label="Home"
            collapsed={collapsed}
            active={pathname === "/"}
          />

          {/* Favorites */}
          {favoriteTables.length > 0 && (
            <>
              {!collapsed && (
                <div className="px-4 pt-4 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Favorites
                </div>
              )}
              {collapsed && <Separator className="my-2 mx-3" />}
              {favoriteTables.map((t) => (
                <SidebarLink
                  key={t.id}
                  href={`/tables/${t.id}`}
                  icon={Star}
                  label={t.name}
                  collapsed={collapsed}
                  active={pathname === `/tables/${t.id}`}
                  onStarClick={() => {
                    void toggleFavorite(t.id)
                  }}
                  starred
                />
              ))}
            </>
          )}

          {/* Tables */}
          {!collapsed && (
            <div className="px-4 pt-4 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tables
            </div>
          )}
          {collapsed && <Separator className="my-2 mx-3" />}
          {otherTables.map((t) => (
            <SidebarLink
              key={t.id}
              href={`/tables/${t.id}`}
              icon={Table2}
              label={t.name}
              collapsed={collapsed}
              active={pathname === `/tables/${t.id}`}
              onStarClick={() => {
                void toggleFavorite(t.id)
              }}
            />
          ))}

          <Separator className="my-2 mx-3" />

          {/* Analytics */}
          <SidebarLink
            href="/analytics"
            icon={BarChart3}
            label="Analytics"
            collapsed={collapsed}
            active={pathname === "/analytics"}
          />

          {/* Admin */}
          {currentUser.role === "admin" && (
            <SidebarLink
              href="/admin"
              icon={Settings}
              label="Admin"
              collapsed={collapsed}
              active={pathname.startsWith("/admin")}
            />
          )}
        </ScrollArea>

        {/* Collapse toggle */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
          <GlobalSearch />

          <div className="ml-auto flex items-center gap-2">
            {/* Theme toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4" />
                  ) : theme === "light" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Monitor className="h-4 w-4" />
                  )}
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="mr-2 h-4 w-4" /> Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="mr-2 h-4 w-4" /> Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Monitor className="mr-2 h-4 w-4" /> System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm md:inline-block">{currentUser.name}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{currentUser.name}</span>
                    {currentUser.email && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {currentUser.email}
                      </span>
                    )}
                    <span className="text-xs font-normal text-muted-foreground capitalize">
                      {currentUser.role}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    void logout()
                  }}
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

// ─── Sidebar link helper ─────────────────────────────────────
function SidebarLink({
  href,
  icon: Icon,
  label,
  collapsed,
  active,
  onStarClick,
  starred,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  collapsed: boolean
  active: boolean
  onStarClick?: () => void
  starred?: boolean
}) {
  const inner = (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {onStarClick && (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onStarClick()
              }}
              className={cn(
                "opacity-0 group-hover:opacity-100 transition-opacity",
                starred && "opacity-100 text-yellow-500"
              )}
            >
              <Star className="h-3.5 w-3.5" fill={starred ? "currentColor" : "none"} />
            </button>
          )}
        </>
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <div className="px-2 py-0.5">
        <Tooltip>
          <TooltipTrigger asChild>{inner}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return <div className="px-2 py-0.5">{inner}</div>
}
