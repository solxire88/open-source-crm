# Contributing

Thanks for contributing.

## Development setup
1. Fork and clone the repo.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment:
   ```bash
   cp .env.example .env.local
   ```
4. Run database migrations on your Supabase project:
   ```bash
   supabase link --project-ref <your-project-ref>
   npm run db:push
   ```
5. Start dev server:
   ```bash
   npm run dev
   ```

## Pull request checklist
- Keep changes focused and minimal.
- Do not commit secrets (`.env.local`, service keys).
- Run:
  ```bash
  npm run typecheck
  ```
- Update docs when behavior changes.

## Commit style
- Use clear, imperative commit messages.
- Prefer small commits over one large mixed commit.

