"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { AppShell } from "@/components/app-shell"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, isBootstrapping } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      router.replace("/login")
    }
  }, [isBootstrapping, isAuthenticated, router])

  if (isBootstrapping || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    )
  }

  return <AppShell>{children}</AppShell>
}
