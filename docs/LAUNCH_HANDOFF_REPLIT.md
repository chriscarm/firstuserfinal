# FirstUser Launch Handoff (Replit Autoscale)

## 1) What changed in this launch-ready pass
- Fixed post-login redirect behavior for protected routes (redirect target is now authoritative).
- Removed founder-tools hardcoding (`firstuser` / appspace ID `1`) and scoped tools by active appspace slug.
- Added a real inbox route: `/messages` with:
  - appspace selector
  - conversation list
  - DM thread pane
- Added discover aggregation endpoint: `GET /api/appspaces/discover` (single payload for card + counts).
- Switched `/` homepage to configurable waitlist slug:
  - `VITE_HOMEPAGE_SPACE_SLUG` (default: `firstuser`)
- Replaced dead-end error states with recovery CTAs (`Retry`, `Go Home`, `Explore`).
- Wired username save in Settings via `/api/auth/username` with validation/sanitization.
- Fixed strict TypeScript issues and notification payload typing mismatch.

## 2) Required environment variables
- `DATABASE_URL`
- `SESSION_SECRET`
- `TEXTBELT_API_KEY`
- `RESEND_API_KEY`

## 3) Recommended environment variables
- `EMAIL_FROM` (recommended for OTP sender consistency)
- `VITE_HOMEPAGE_SPACE_SLUG` (defaults to `firstuser` if omitted)
- `FOUNDER_PHONES` (comma-separated founder bootstrap phones)

## 4) Local setup
```bash
npm install
npm run check
npm run build
```

## 5) Replit deploy setup
1. In Replit Secrets, add all required env vars from section 2.
2. Add recommended vars from section 3 as needed.
3. Keep deployment target as `autoscale` (already configured in `.replit`).
4. Deploy using the project deployment button or:
   - Build command: `npm run build`
   - Run command: `node ./dist/index.cjs`

## 6) Production smoke test checklist
### Auth + redirect
- Open a protected route while signed out (e.g. `/dashboard`, `/messages`, `/space/:slug/founder-tools`).
- Complete auth and confirm you return to the exact original route.

### Homepage
- Visit `/` and confirm it loads the configured homepage appspace.
- Change `VITE_HOMEPAGE_SPACE_SLUG`, redeploy, confirm `/` switches target.

### Founder tools
- Open `/space/:slug/founder-tools` and verify all data mutations affect the selected slug only.
- Open `/founder-tools` and verify fallback behavior:
  - first founder-owned space if available
  - guided empty state if none

### Messages
- Click mail icon in left rail and confirm navigation to `/messages`.
- Select a community in selector and verify conversations + DM pane load.
- Confirm pending-member DM restrictions and approved-member DM send behavior.

### Discover pages
- Open `/explore` and `/dashboard`.
- Confirm both load discover data from a single aggregated request.

### Build health
- `npm run check` passes.
- `npm run build` passes.

## 7) Notes for scaling/reliability next
- OTP store is currently in-memory (good for development, not durable across restarts).
- Move OTP/session-critical short-lived auth data to Redis for multi-instance resiliency.
- Add route-level monitoring for:
  - auth completion success/failure
  - `/messages` errors
  - websocket connection errors
  - 4xx/5xx on founder moderation endpoints
