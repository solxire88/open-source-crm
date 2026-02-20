"use client"

import React, { useRef, useState } from "react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ImageIcon, Trash2, Upload } from "lucide-react"

export function AdminBrandingTab() {
  const { org, updateLogo } = useStore()
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleUpload = async (file: File) => {
    setSubmitting(true)
    try {
      await updateLogo(file)
      toast.success("Logo updated")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload logo"
      toast.error(message)
    } finally {
      setSubmitting(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  const handleRemove = async () => {
    setSubmitting(true)
    try {
      await updateLogo(null)
      toast.success("Logo removed")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove logo"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Logo</CardTitle>
          <CardDescription>
            Upload a logo for your organization. It will appear in the sidebar and login page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            {org.logoUrl ? (
              <img
                src={org.logoUrl}
                alt="Company logo"
                className="h-16 w-16 rounded-lg object-cover border"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25">
                <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{org.name}</p>
              <p className="text-xs text-muted-foreground">
                {org.logoUrl ? "Logo set" : "No logo uploaded"}
              </p>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              void handleUpload(file)
            }}
          />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="gap-1.5"
              disabled={submitting}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload logo
            </Button>
            {org.logoUrl ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRemove()}
                className="gap-1.5 text-xs"
                disabled={submitting}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

