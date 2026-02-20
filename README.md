# Open Source CRM

An open-source CRM for small teams that need a practical pipeline without enterprise bloat.

Built with Next.js + Supabase, this project gives you table-based lead management, strict per-table permissions, CSV import/export, analytics, and an admin console you can self-host for free-tier use cases (Vercel + Supabase).

## Who It Is For
- Small sales teams and agencies
- Founders running outbound + follow-up workflows
- Developers who want a customizable CRM backend with RLS-first security

## Features
- Auth + multi-tenant org model on Supabase
- Table-based lead workspaces
- Per-table read/edit permissions with strict invisibility for unauthorized users
- Lead lifecycle workflow:
  claim -> contact -> update stage/notes -> set next follow-up
- Views: Pipeline, New Leads, My Leads, Follow-ups Due, Calendar
- Lead details drawer with notes, history, and attachments
- CSV import and export templates
- Analytics endpoint + dashboard widgets
- Admin console for users, tables, permissions, services catalog, exports, and branding
- Supabase RLS policies and audit events

## Screenshots
![Tables page](images/Tables%20page.png)
![Pipeline page](images/Pipeline%20Page.png)
![Analytics page](images/Analytics%20Page.png)

## Tech Stack
- Next.js (App Router, TypeScript)
- Supabase (Postgres, Auth, Storage, RLS)
- Vercel (frontend hosting)

## 5-Minute Quickstart
### 1) Clone and install
```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
npm install
```

### 2) Environment variables
```bash
cp .env.example .env.local
```

Fill `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3) Connect Supabase and apply schema
```bash
supabase login
supabase link --project-ref <your-project-ref>
npm run db:push
```

### 4) Optional demo seed
```bash
npm run seed
```

### 5) Start app
```bash
npm run dev
```

Open `http://localhost:3000`.

## Database Reset Workflows
### Local reset (fresh local project state)
Runs migrations + `supabase/seed.sql` (minimal clean seed):
```bash
npm run db:reset:local
```

### Remote project (fresh hosted Supabase project)
```bash
supabase link --project-ref <your-project-ref>
npm run db:push
```

Then optionally:
```bash
npm run seed
```

## Environment & Secrets Safety
- `.env.local` is ignored by git.
- Never commit service role keys.
- If `.env.local` was accidentally tracked in your repo history:
```bash
git rm --cached .env.local
git commit -m "chore: stop tracking local env"
```
- Rotate leaked keys immediately in Supabase Dashboard.

## Deploy for Free (Vercel + Supabase)
### 1) Create a Supabase project
- Create project at https://supabase.com
- In `Project Settings -> API`, copy:
  - `Project URL`
  - `anon` key
  - `service_role` key
- Apply migrations:
```bash
supabase link --project-ref <your-project-ref>
npm run db:push
```

### 2) Deploy frontend to Vercel
- Import repo into Vercel
- Set environment variables in Vercel project settings:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Deploy

### 3) Auth redirect URLs
In Supabase Auth URL settings, add:
- your Vercel production URL
- preview URL pattern if you use previews

## Scripts
- `npm run dev` - local Next.js server
- `npm run build` - production build
- `npm run typecheck` - TypeScript checks
- `npm run db:push` - push migrations to linked Supabase project
- `npm run db:reset:local` - reset local Supabase DB
- `npm run seed` - optional demo seed data
- `npm run scrape:to-crm` - scraping/import helper script

## Mini Tutorial: Scrape -> Import -> Track Leads
See [`docs/scrape-to-crm.md`](docs/scrape-to-crm.md).

## Contributing
See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License
MIT - see [`LICENSE`](LICENSE).

## Roadmap Ideas
- Better mobile UX for pipeline drag/drop
- Saved analytics views by role
- Duplicate detection UX during CSV import
- Activity notifications and reminders
- More granular audit/event filtering

