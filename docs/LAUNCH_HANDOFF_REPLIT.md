# FirstUser Launch Handoff (Replit Autoscale)

## 1) What changed in this full launch-ready pass
- Persisted OTP verification in DB (`auth_verifications`) with lockout + throttle controls.
- Added auth risk tracking (`auth_risk_events`) for rate-limit, invalid OTP, lockout, and identity-collision events.
- Migrated email OTP provider to SendGrid (`server/email.ts` uses `@sendgrid/mail`).
- Added Golden Ticket V1 domain + enforcement:
  - public status endpoint (winner identity private)
  - founder management endpoints (policy, tiers, winner select)
  - policy report + admin resolution workflow
  - immutable audit event trail
- Added Golden Ticket UI surfaces:
  - Founder Tools tab (`Golden Ticket`)
  - Explore card state chip
  - Landing page trust/status messaging
  - Profile Golden Ticket status section
- Completed settings persistence for all toggles and wired real account deletion.
- Added health and readiness endpoints:
  - `GET /api/healthz`
  - `GET /api/readyz`
- Added security headers, request correlation IDs, and scoped API rate limits.

## 2) Required environment variables
- `DATABASE_URL`
- `SESSION_SECRET`
- `TEXTBELT_API_KEY`
- `SENDGRID_API_KEY`
- `EMAIL_FROM`

## 3) Recommended environment variables
- `VITE_HOMEPAGE_SPACE_SLUG` (defaults to `firstuser`)
- `FOUNDER_PHONES` (comma-separated founder bootstrap phones)

## 4) First deploy order (Replit)
1. Add all required env vars in Replit Secrets.
2. Run schema sync:
   - `npm run db:push`
3. Build and type gate:
   - `npm run check`
   - `npm run build`
4. Deploy autoscale target.

## 5) Smoke tests (must-pass)
- Auth:
  - `/api/auth/phone/start` + `/api/auth/phone/verify`
  - `/api/auth/email/start` + `/api/auth/email/verify`
- Homepage and discovery:
  - `/`
  - `/explore`
  - `/space/:slug`
- Community + DM:
  - `/space/:slug/community`
  - `/messages`
- Founder tools:
  - `/space/:slug/founder-tools`
  - Golden Ticket policy/tiers/winner flow
- Settings:
  - save all toggles
  - delete account flow
- Ops endpoints:
  - `/api/healthz`
  - `/api/readyz`

## 6) New API routes to verify
- `GET /api/appspaces/:id/golden-ticket/public`
- `GET /api/appspaces/:id/golden-ticket/founder`
- `PUT /api/appspaces/:id/golden-ticket/policy`
- `PUT /api/appspaces/:id/golden-ticket/tiers`
- `POST /api/appspaces/:id/golden-ticket/select-winner`
- `POST /api/appspaces/:id/golden-ticket/report`
- `GET /api/appspaces/:id/golden-ticket/audit`
- `PATCH /api/admin/policy-events/:id`

## 7) Rollback notes
- Keep previous Replit deployment version available for instant rollback.
- If rollback is needed:
  1. Revert deployment version.
  2. Keep schema additions (non-destructive) but disable Golden Ticket writes.
  3. Re-run smoke tests on reverted version.
