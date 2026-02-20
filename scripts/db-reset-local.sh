#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install it first: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo "Starting local Supabase stack..."
supabase start

echo "Resetting local database (migrations + supabase/seed.sql)..."
supabase db reset --local

echo "Local database reset complete."
