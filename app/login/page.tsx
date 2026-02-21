"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
    const router = useRouter()
    const { isAuthenticated, isBootstrapping, loginWithPassword, org } = useStore()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [brandingName, setBrandingName] = useState("Sales CRM")
    const [brandingLogoUrl, setBrandingLogoUrl] = useState<string | null>(null)

    // If already authenticated, redirect to home
    useEffect(() => {
        if (isAuthenticated) {
            router.replace("/")
        }
    }, [isAuthenticated, router])

    useEffect(() => {
        if (org.name) {
            setBrandingName(org.name)
        }
        if (org.logoUrl !== undefined) {
            setBrandingLogoUrl(org.logoUrl ?? null)
        }
    }, [org.logoUrl, org.name])

    useEffect(() => {
        let active = true

        const loadBranding = async () => {
            try {
                const response = await fetch("/api/public/branding", { cache: "no-store" })
                if (!response.ok) return

                const payload = await response.json()
                const organization = payload?.organization
                if (!active || !organization) return

                if (typeof organization.name === "string" && organization.name.trim().length > 0) {
                    setBrandingName(organization.name)
                }
                setBrandingLogoUrl(organization.logo_signed_url ?? organization.logo_url ?? null)
            } catch {
                // Keep local fallback branding.
            }
        }

        void loadBranding()

        return () => {
            active = false
        }
    }, [])

    const brandingInitial = brandingName.trim().charAt(0).toUpperCase() || "A"

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
          await loginWithPassword(email.trim(), password)
          router.push("/")
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to sign in"
          toast.error(message)
        } finally {
          setSubmitting(false)
        }
    }

    if (isBootstrapping) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    {brandingLogoUrl ? (
                        <img
                            src={brandingLogoUrl}
                            alt={`${brandingName} logo`}
                            className="mx-auto mb-4 h-10 w-10 rounded-lg object-cover border"
                        />
                    ) : (
                        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                            {brandingInitial}
                        </div>
                    )}
                    <CardTitle className="text-xl">Welcome back</CardTitle>
                    <CardDescription>Sign in to your account to continue</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSignIn} className="flex flex-col gap-4 pt-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={submitting}>
                            Sign in
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
