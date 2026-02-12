# FirstUser Launch Readiness Checklist

Use this as the single go-live gate for the launch-ready branch.

## 1. Environment and Secrets
- [ ] `DATABASE_URL` configured
- [ ] `SESSION_SECRET` configured (strong random value)
- [ ] `TEXTBELT_API_KEY` configured
- [ ] `SENDGRID_API_KEY` configured
- [ ] `EMAIL_FROM` configured
- [ ] `VITE_HOMEPAGE_SPACE_SLUG` configured (or default `firstuser`)
- [ ] `FOUNDER_PHONES` configured for bootstrap founder verification
- [ ] `HOMEPAGE_OWNER_PHONE` configured (`13477444249`) for homepage ownership lock and auto-transfer

## 2. Data and Schema
- [ ] Run `npm run db:push` in target environment
- [ ] Confirm new tables exist:
  - [ ] `auth_verifications`
  - [ ] `auth_risk_events`
  - [ ] `golden_tickets`
  - [ ] `ticket_tiers`
  - [ ] `ticket_audit_events`
  - [ ] `ticket_policy_events`
- [ ] Confirm legacy data remains intact after schema push

## 3. Build and Type Gates
- [ ] `npm run check` passes
- [ ] `npm run build` passes
- [ ] `npm start` serves app successfully

## 4. Core User Journey Smoke Tests
- [ ] `/` loads canonical waitlist homepage
- [ ] User can discover communities in `/explore`
- [ ] User can open `/space/:slug` and join waitlist
- [ ] Pending member can read but not post restricted actions
- [ ] Approved member can post and DM
- [ ] Mail icon opens `/messages` and DM flow works
- [ ] Founder can access `/space/:slug/founder-tools`

## 5. Golden Ticket V1 Enforcement
- [ ] Founder view route works: `GET /api/appspaces/:id/golden-ticket/founder`
- [ ] Public status route hides winner identity: `GET /api/appspaces/:id/golden-ticket/public`
- [ ] Tier update blocks invalid policies:
  - [ ] fewer than 3 tiers rejected
  - [ ] rank 1 non-lifetime rejected
  - [ ] existing benefits removal rejected
- [ ] Winner can only be selected once
- [ ] Team-edge rule enforced at selection time
- [ ] Audit events are created for policy/tier/winner actions
- [ ] Policy report flow works and admin resolution updates reporter notification

## 6. Auth and Trust Controls
- [ ] Phone OTP persists across restarts (DB-backed)
- [ ] Email OTP persists across restarts (DB-backed)
- [ ] Invalid OTP retries increment attempts and trigger lockout
- [ ] Throttling triggers on excessive requests
- [ ] Collision risk events are logged when duplicate normalized identity appears

## 7. Settings and Account Lifecycle
- [ ] Username save persists and reloads correctly
- [ ] All notification/privacy toggles persist and reload:
  - [ ] `emailNotifications`
  - [ ] `smsNotifications`
  - [ ] `pollReminders`
  - [ ] `dmNotifications`
  - [ ] `badgeAlerts`
  - [ ] `showOnlineStatus`
  - [ ] `allowDmsFromAnyone`
- [ ] Account deletion endpoint works and session invalidates

## 8. Notifications and Realtime
- [ ] Waitlist approve/reject generates in-app notification + socket push
- [ ] DM send generates in-app notification + socket push
- [ ] Golden Ticket winner/report resolution notifications delivered
- [ ] Unread counters stay consistent between REST and websocket updates

## 9. Security and Operations
- [ ] Security headers present in responses
- [ ] Correlation ID present in API responses/logs
- [ ] Health endpoint works: `/api/healthz`
- [ ] Readiness endpoint works: `/api/readyz`
- [ ] Scoped rate limits are active for auth/messaging/write routes

## 10. Replit Deployment
- [ ] Deploy to Replit Autoscale staging
- [ ] Run full smoke pass in staging
- [ ] Promote to production after clean smoke pass
- [ ] Rollback plan validated before final cutover
