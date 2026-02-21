import type { Metadata, Viewport } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { StoreProvider } from "@/lib/store"
import { Toaster } from "sonner"

import "./globals.css"

export const metadata: Metadata = {
  title: "Sales CRM",
  description: "Modern minimalist Sales Management Platform",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <StoreProvider>
            <TooltipProvider delayDuration={0}>
              {children}
              <Toaster richColors position="bottom-right" />
            </TooltipProvider>
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
