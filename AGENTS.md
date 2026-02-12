# Project: FirstUser

## Stack
- React 19 + TypeScript (frontend)
- Express 5 + Node.js (backend)
- Drizzle ORM + PostgreSQL (database)
- Tailwind CSS v4 + shadcn/ui (styling)
- Vite 7 (build tool)
- Wouter (routing)
- TanStack Query (server state)
- Package manager: npm

## Build & Test
- Install: `npm install`
- Typecheck: `npm run check`
- Build: `npm run build`
- Full verify (run before marking any task done): `npm run verify`
- Quick verify (while iterating): `npm run verify:quick`
- DB migrations: `npm run db:push`

## Rules
- Prefer feature branches for larger work. In CEO hands-off mode, Codex may commit/push the current branch automatically unless the user asks for a specific branch flow.
- Run `npm run verify` before marking any task complete.
- Do not modify `.replit`, `replit.nix`, or `replit.md` unless explicitly asked.
- Do not commit `.env` files or secrets. Use `process.env.VAR_NAME` in code.
- Before starting any task, check if main has commits not authored by Codex.
  If it does, read those commits first to understand recent changes.

## Autonomous Git Mode (CEO Hands-Off)
- The user should not need to type git commands or commit messages.
- At the end of every code-changing task, Codex must run the repo automation flow and push to GitHub automatically.
- Use `npm run ship` with an auto-generated commit message when needed.
- Do not ask the user to provide a commit message unless they explicitly request custom wording.
- Keep the compile gate enabled: commits must pass `npm run verify` before they are accepted.
- If verify fails, Codex fixes the issue and retries automatically before finishing the task.
- Only skip commit/push when the user explicitly says not to push.

## Environment Variables (names only — see .env.example)
- DATABASE_URL
- SESSION_SECRET
- TEXTBELT_API_KEY
- SENDGRID_API_KEY
- EMAIL_FROM
- FOUNDER_PHONES
- HOMEPAGE_OWNER_PHONE
- VITE_HOMEPAGE_SPACE_SLUG

## Project Structure
```
client/src/           # React frontend
  components/ui/      # shadcn/ui components
  pages/              # Route components
  lib/                # Utilities, API client, auth hooks
server/               # Express backend
  routes.ts           # API endpoints
  storage.ts          # Database access layer
  db.ts               # Drizzle connection
  email.ts            # SendGrid integration
  sms.ts              # Textbelt SMS integration
shared/               # Shared types and schemas
  schema.ts           # Drizzle table definitions
```

## Design System
- Dark purple theme with glass morphism effects
- Typography: Inter (body), Space Grotesk (headlines)
- Background: Deep void (#0a0510) with violet/fuchsia gradients
- Custom CSS classes: `glass-panel`, `glass-input`, `btn-gradient`, `text-gradient`

## Key Concepts
- **AppSpaces**: Waitlist communities created by founders with slug-based URLs
- **WaitlistMembers**: Join records tracking position and badge tier (1st, 10^1, 10^2, 10^3, 10^4)
- **FOUNDER_PHONES**: Comma-separated phone numbers that get platform-level founder access on verification
