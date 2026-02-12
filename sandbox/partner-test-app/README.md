# FirstUser Partner Test App (No-Code Sandbox)

This is a full local sandbox app you can use to test your FirstUser integration end-to-end.

It covers:
- Redirect waitlist flow (hosted by FirstUser)
- Embedded waitlist flow (`/api/integration/v1/waitlist/start`)
- Access code exchange (`/api/integration/v1/access/exchange`)
- Usage heartbeat (`/api/integration/v1/usage/heartbeat`)
- Plan updates (`/api/integration/v1/users/:externalUserId/plan`)
- Hosted chat widget token + iframe (`/api/integration/v1/chat/widget-token`)
- Webhook signature verification (`x-firstuser-signature-sha256`)

## What to run

1. Start FirstUser app:

```bash
npm run dev
```

2. In a second terminal, set sandbox env vars and run this partner app:

```bash
export FIRSTUSER_BASE_URL=http://localhost:5000
export PARTNER_APP_BASE_URL=http://localhost:5051
export FIRSTUSER_PUBLIC_APP_ID=app_replace_me
export FIRSTUSER_API_KEY='fuk_xxx.fus_xxx'
export FIRSTUSER_WEBHOOK_SECRET='fuws_xxx'
npm run sandbox:partner-test-app
```

3. Open the sandbox UI:

- [http://localhost:5051](http://localhost:5051)

## Founder Tools values to paste

In FirstUser Founder Tools -> Integrate for your app space:

- Web Redirect URL: `http://localhost:5051/auth/firstuser`
- Webhook URL: `http://localhost:5051/webhooks/firstuser`
- Public App ID: set this in sandbox env as `FIRSTUSER_PUBLIC_APP_ID`
- API key: set in sandbox env as `FIRSTUSER_API_KEY`
- Webhook secret: set in sandbox env as `FIRSTUSER_WEBHOOK_SECRET`

## Click-by-click test flow (non-technical)

1. In sandbox, sign in as a local partner user (any external user ID like `partner_user_001`).
2. Click **Start Redirect Waitlist Flow** (or Embedded flow).
3. Complete FirstUser signup/waitlist.
4. In FirstUser Founder Tools/Members, approve that user.
5. Back in sandbox, look at **Access Links Issued By FirstUser**.
6. Click **Use access link** for that user.
7. You should return to sandbox and see successful access exchange.
8. Heartbeat should start and show in FirstUser Live Now (approved users only).
9. Click **Load Hosted Chat Widget** and verify chat appears.
10. Change plan tier in sandbox and click **Sync Plan Tier**.

## Notes

- This sandbox is intentionally simple and in-memory.
- It is for integration testing, not production use.
- Secrets are only used server-side in `server.mjs`.
