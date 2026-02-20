"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
    const router = useRouter()
    const { isAuthenticated, isBootstrapping, loginWithPassword, loginWithMagicLink } = useStore()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [submitting, setSubmitting] = useState(false)

    // If already authenticated, redirect to home
    useEffect(() => {
        if (isAuthenticated) {
            router.replace("/")
        }
    }, [isAuthenticated, router])

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

    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
          await loginWithMagicLink(email.trim())
          toast.success("Magic link sent. Check your inbox.")
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to send magic link"
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
                    <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                        A
                    </div>
                    <CardTitle className="text-xl">Welcome back</CardTitle>
                    <CardDescription>Sign in to your account to continue</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="password">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="password">Password</TabsTrigger>
                            <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
                        </TabsList>

                        <TabsContent value="password">
                            <form onSubmit={handleSignIn} className="flex flex-col gap-4 pt-4">
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
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password">Password</Label>
                                        <button
                                            type="button"
                                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
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
                        </TabsContent>

                        <TabsContent value="magic-link">
                            <form onSubmit={handleMagicLink} className="flex flex-col gap-4 pt-4">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="magic-email">Email</Label>
                                    <Input
                                        id="magic-email"
                                        type="email"
                                        placeholder="you@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={submitting}>
                                    Send magic link
                                </Button>
                                <p className="text-xs text-center text-muted-foreground">
                                    {"We'll send you a magic link to sign in without a password."}
                                </p>
                            </form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
