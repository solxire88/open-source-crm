declare module '@supabase/supabase-js' {
  export interface User {
    id: string
    email?: string | null
  }

  export type SupabaseClient = any

  export function createClient(
    url: string,
    key: string,
    options?: Record<string, unknown>,
  ): SupabaseClient
}

declare module '@supabase/ssr' {
  export function createServerClient(
    url: string,
    key: string,
    options?: Record<string, unknown>,
  ): any

  export function createBrowserClient(
    url: string,
    key: string,
    options?: Record<string, unknown>,
  ): any
}
