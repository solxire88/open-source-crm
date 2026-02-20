# Scrape -> Import -> Track Leads in CRM

This guide shows a safe workflow to collect public lead data and move it into the CRM.

## 1) Responsible scraping first
- Check each site `robots.txt` before scraping.
- Respect each site's Terms of Service.
- Scrape only public pages you are allowed to crawl.
- Use rate limiting (slow requests, no bursts).
- Set an honest User-Agent with contact information.
- Do not collect sensitive/personal data you do not need.

## 2) Script overview
Use `scripts/scrape-to-crm.mjs` to:
- read URLs from `--input` CSV or `--urls`
- fetch pages with retries + delay
- extract:
  - company name (from page title/hostname)
  - website URL
  - first email if available
  - notes (meta description/source)
- validate and dedupe records
- dry-run by default (no DB writes)
- optional direct insert into Supabase leads table

## 3) Setup
```bash
npm install
cp .env.example .env.local
```

Set env vars in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Important:
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only.
- Never expose it in browser/client code.

## 4) Dry run (safe default)
Using sample URL list:
```bash
npm run scrape:to-crm -- --input samples/scrape-urls.csv --dry-run true
```

Or inline URLs:
```bash
npm run scrape:to-crm -- --urls https://example.com,https://www.iana.org/domains/reserved
```

## 5) Insert into CRM (write mode)
You need:
- a target table ID (`SCRAPE_TABLE_ID`)
- an existing user ID for `created_by/updated_by` (`SCRAPE_ACTOR_USER_ID`)

Example:
```bash
npm run scrape:to-crm -- \
  --input samples/scrape-urls.csv \
  --write \
  --table-id <table_uuid> \
  --actor-user-id <user_uuid>
```

Optional tuning:
- `--delay-ms 1500`
- `--retries 3`
- `--user-agent "YourCompanyBot/1.0 (+you@company.com)"`

## 6) What happens after import
Imported leads are created with:
- `stage = New`
- `source_type = Scraping`
- `source_detail = script:scrape-to-crm`

Then in the app:
1. Open the table workspace.
2. Review leads in New Leads tab.
3. Claim lead ownership.
4. Contact lead and log touch.
5. Update stage and next follow-up date.

## 7) Security checklist
- Keep dry-run as default in scripts.
- Keep service role key only in local/server env.
- Rotate keys if you ever leak them.
- Add domain allowlists if your workflow needs stricter control.
