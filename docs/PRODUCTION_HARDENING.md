# FirstUser Production Hardening Runbook

This is the launch-safe checklist for getting FirstUser from "works locally" to "safe for real users".

## 1) Infrastructure baseline (managed services)

Use managed services so uptime, backups, and failover are not on one laptop.

- App runtime: Render, Railway, Fly.io, or AWS ECS/Fargate
- Database: managed Postgres with point-in-time recovery (Neon, RDS, Supabase, or equivalent)
- CDN + TLS + domain: Cloudflare or managed platform domain + SSL

Minimum setup:
- Production app domain: `https://app.firstuser.com`
- API served from same domain (or clearly defined API domain)
- Production Postgres with automated backups enabled
- Staging environment that mirrors production shape

## 2) Backup and restore policy

Backups are only useful if restore is tested.

Requirements:
- Continuous WAL/PITR enabled
- Daily snapshot retention >= 14 days
- Weekly restore drill to a temporary database
- Restore drill evidence stored in ops notes

Restore drill template:
1. Restore latest backup to temp DB.
2. Point staging to restored DB.
3. Verify: login, founder tools load, integration setup load, live users API response.
4. Record RTO (time to recover) and issues.

## 3) Required env vars for production

Set these in your production secret manager:

- `DATABASE_URL`
- `SESSION_SECRET` (strong, 32+ chars)
- `PUBLIC_APP_URL` (must be `https://...`)
- `TEXTBELT_API_KEY`
- `SENDGRID_API_KEY`
- `EMAIL_FROM`
- `FOUNDER_PHONES`
- `HOMEPAGE_OWNER_PHONE`
- `VITE_HOMEPAGE_SPACE_SLUG`
- `INTEGRATION_WIDGET_SIGNING_SECRET`
- `INTEGRATION_WEBHOOK_SIGNING_SECRET` (fallback only)
- `OPS_ALERT_WEBHOOK_URL` (Slack/Discord incoming webhook)

## 4) Monitoring and alerting

### Health checks
- `GET /api/healthz`
- `GET /api/readyz`

### Alerts that must page someone
- Unhandled server exceptions (`5xx` burst)
- Webhook delivery retries exhausted
- Retry loop failures
- Database unavailable (`readyz` failing)

Current implementation sends ops alerts to `OPS_ALERT_WEBHOOK_URL` and includes:
- severity
- title
- message
- metadata (integration app id, delivery id, attempt, status)

## 5) Secret handling and rotation runbook

### Integration API key
- Rotate via Founder Tools -> Integrate -> Rotate Key
- Update partner backend secret store immediately
- Verify `/api/integration/v1/waitlist/start` succeeds with new key

### Integration webhook secret
- Rotate via Founder Tools -> Integrate -> Rotate Secret
- Update partner webhook signature validator immediately
- Send test webhook and verify signature accepted

### Platform secrets
- Rotate `SESSION_SECRET` and widget signing secrets on a planned window
- Keep old/new overlap plan for partner keys where needed

Recommended cadence:
- Integration API keys: every 90 days
- Webhook secrets: every 90 days
- Platform secrets: every 180 days or after any incident

## 6) Go-live preflight (day before launch)

1. `healthz` and `readyz` are green in production.
2. Backup restore drill completed in the last 7 days.
3. Ops alerts confirmed (send test alert and receive it).
4. Full integration smoke test passed:
   - redirect waitlist
   - embedded waitlist
   - access exchange
   - heartbeat
   - widget token + chat load
   - webhook signature verification
5. Incident owner and rollback owner are assigned.

## 7) Incident rollback rules

If these happen, pause onboarding and rollback:
- Access exchange error rate > 5% for 10+ minutes
- Webhook terminal failures across multiple integrations
- `readyz` fails for > 2 minutes

Rollback options:
- Roll back app deploy
- Disable integration feature flag per app space
- Pause outbound webhook retries while debugging root cause

