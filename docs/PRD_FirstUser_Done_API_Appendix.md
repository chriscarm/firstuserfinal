# FirstUser `done` API Appendix

## Purpose
This appendix documents the baseline API and realtime contracts implemented in `/Users/christophercarmichael/Desktop/done`.

## Scope Notes
- Source: `/Users/christophercarmichael/Desktop/done/server/routes.ts` and `/Users/christophercarmichael/Desktop/done/server/websocket.ts`.
- Endpoint inventory includes 73 REST endpoints under `/api`.
- This appendix documents current behavior only. It does not introduce runtime changes.

## Auth Legend
- `Public`: no auth middleware on route.
- `Auth`: `requireAuth`.
- `Founder`: `requireFounder` or route-level founder checks.
- `AppSpaceFounder`: `requireAppSpaceFounder()`.

## 1. Public, Discovery, And Core Navigation

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/stats/public | Public | Public aggregate stats for landing/discovery surfaces. |
| GET | /api/appspaces | Public | List AppSpaces for Explore/discovery. |
| GET | /api/appspaces/:slug | Public | Fetch AppSpace details by slug. |
| GET | /api/appspaces/:slug/public | Public | Public AppSpace variant for non-member contexts. |
| GET | /api/appspaces/:id/next-position | Public | Return next waitlist position preview. |
| GET | /api/users/:userId/profile | Public | Public user profile lookup. |

## 2. Founder Platform Operations

| Method | Path | Auth | Purpose |
|---|---|---|---|
| PATCH | /api/founder/appspaces/:slug | Founder | Update founder-controlled AppSpace settings by slug. |
| GET | /api/founder/users | Founder | List users for founder management workflows. |
| POST | /api/founder/users/:userId/award-badge | Founder | Award a badge tier to a user. |

## 3. Auth And Identity

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | Public | Register account credentials. |
| POST | /api/auth/login | Public | Credential login. |
| POST | /api/auth/logout | Public | Logout current session. |
| GET | /api/auth/me | Auth | Return authenticated user session profile. |
| POST | /api/auth/phone/start | Public | Start phone OTP flow via TextBelt. |
| POST | /api/auth/phone/verify | Public | Verify phone OTP and establish session. |
| POST | /api/auth/phone/send | Auth | Legacy authenticated phone OTP send flow. |
| POST | /api/auth/phone/verify-legacy | Auth | Legacy authenticated phone OTP verify flow. |
| POST | /api/auth/email/start | Public | Start email OTP flow via Resend. |
| POST | /api/auth/email/verify | Public | Verify email OTP and establish session. |
| GET | /api/auth/username/check | Public | Username availability check. |
| POST | /api/auth/username | Auth | Save username for authenticated user. |

## 4. User Profile, Settings, And Personal State

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/users/me/appspaces | Auth | List AppSpaces user belongs to. |
| PATCH | /api/users/me/settings | Auth | Update user preference settings. |
| GET | /api/users/me/settings | Auth | Retrieve user preference settings. |
| PATCH | /api/users/me/profile | Auth | Update user profile details. |
| GET | /api/users/me/uncelebrated-badges | Auth | Fetch uncelebrated badge awards. |
| POST | /api/users/me/badges/:badgeId/celebrated | Auth | Mark badge celebration consumed. |

## 5. Media Upload And Asset Processing

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/upload | Auth | Upload file (image pipeline with server processing). |

## 6. AppSpace Lifecycle, Waitlist, And Survey

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/appspaces | Auth | Create AppSpace. |
| GET | /api/appspaces/:id/waitlist | Public | Get waitlist snapshot for AppSpace. |
| POST | /api/appspaces/:id/join | Auth | Join AppSpace waitlist. |
| GET | /api/appspaces/:id/survey | Public | Fetch AppSpace survey configuration. |
| POST | /api/appspaces/:id/survey/respond | Auth | Submit survey responses. |
| PATCH | /api/appspaces/:id/waitlist/:userId | Auth | Update specific waitlist member state (approval/reject/ban path with founder checks). |
| POST | /api/appspaces/:id/waitlist/bulk | Auth | Apply moderation action to multiple waitlist members. |
| GET | /api/appspaces/:id/waitlist/members | Auth | Retrieve waitlist members for founder management views. |

## 7. Founder Content: Announcements, Polls, Badges, And Stats

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/appspaces/:id/announcements | Public | List AppSpace announcements. |
| POST | /api/appspaces/:id/announcements | Auth | Create announcement (optional SMS fanout). |
| DELETE | /api/appspaces/:id/announcements/:announcementId | Auth | Delete announcement. |
| GET | /api/appspaces/:id/polls | Public | List polls for AppSpace. |
| POST | /api/appspaces/:id/polls | Auth | Create poll. |
| POST | /api/appspaces/:id/polls/:pollId/vote | Auth | Cast poll vote. |
| GET | /api/appspaces/:id/polls/:pollId/results | Public | Retrieve poll results. |
| GET | /api/appspaces/:id/custom-badges | Public | List custom badges for AppSpace. |
| POST | /api/appspaces/:id/custom-badges/:badgeId/award | Auth | Award custom badge to user. |
| GET | /api/appspaces/:id/users/:userId/badges | Public | Fetch user badges in AppSpace context. |
| GET | /api/appspaces/:id/founder-stats | Auth | Founder stats and operational metrics. |

## 8. Channels, Messaging, And Direct Messages

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/appspaces/:id/channels | Public | List channels for AppSpace. |
| GET | /api/appspaces/:id/members | Public | List AppSpace members for side panel/member UI. |
| POST | /api/appspaces/:id/channels | AppSpaceFounder | Create channel within AppSpace. |
| GET | /api/channels/:channelId/messages | Auth | Fetch channel message history. |
| POST | /api/channels/:channelId/messages | Auth | Post channel message. |
| GET | /api/appspaces/:id/conversations | Auth | List DM conversations in AppSpace. |
| POST | /api/appspaces/:id/conversations | Auth | Create/find DM conversation. |
| POST | /api/appspaces/:id/conversations/founder | Auth | Founder-initiated conversation flow. |
| GET | /api/conversations/:conversationId/messages | Auth | Fetch DM message history. |
| POST | /api/conversations/:conversationId/messages | Auth | Send DM message. |
| GET | /api/appspaces/:id/unread-counts | Auth | Aggregate unread counts per channel. |
| POST | /api/channels/:channelId/read | Auth | Mark channel as read. |
| GET | /api/appspaces/:id/messages/search | Auth | Search messages in AppSpace scope. |

## 9. Engagement Signals: Reactions And Notifications

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/messages/:messageId/reactions | Auth | Add/toggle message reaction. |
| DELETE | /api/messages/:messageId/reactions/:emoji | Auth | Remove message reaction. |
| GET | /api/messages/:messageId/reactions | Public | Fetch reaction aggregates for message. |
| GET | /api/notifications | Auth | List notifications for current user. |
| POST | /api/notifications/:id/read | Auth | Mark one notification as read. |
| POST | /api/notifications/read-all | Auth | Mark all notifications as read. |

## 10. Drafts And Internal Admin Backlog

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/appspaces/draft | Auth | Save/update CreateSpace draft payload. |
| GET | /api/appspaces/draft | Auth | Retrieve current user draft payload. |
| DELETE | /api/appspaces/draft | Auth | Delete current user draft payload. |
| GET | /api/admin/ideas | Auth | List admin ideas backlog. |
| POST | /api/admin/ideas | Auth | Create admin idea. |
| PATCH | /api/admin/ideas/:id | Auth | Update admin idea state/content. |
| DELETE | /api/admin/ideas/:id | Auth | Delete admin idea. |

## 11. Realtime Contract (Socket.IO)

### Client -> Server events
- `join-channel`
- `leave-channel`
- `typing-start`
- `typing-stop`
- `send-message`
- `dm:join`
- `dm:leave`
- `dm:typing-start`
- `dm:typing-stop`
- `dm:message`

### Server -> Client events
- `error`
- `presence:online-users`
- `typing-users`
- `dm:typing-users`
- `dm:user-typing`
- `dm:user-stopped-typing`
- `dm:message-received`

### Realtime permission behaviors
- Membership and approval checks are enforced before join/send operations.
- Pending users are blocked from certain send paths.
- Conversation participation is validated for DM events.

## 12. Data Entities (Schema Glossary)

### Identity and user state
- `users`
- `userSettings`

### AppSpace core
- `appSpaces`
- `appSpaceDrafts`

### Waitlist and onboarding
- `waitlistMembers`
- `surveyQuestions`
- `surveyResponses`

### Founder communications and incentives
- `announcements`
- `polls`
- `pollVotes`
- `customBadges`
- `badgeAwards`

### Community messaging
- `channels`
- `chatMessages`
- `conversations`
- `conversationParticipants`
- `directMessages`

### Engagement tracking
- `userChannelRead`
- `notifications`
- `messageReactions`

### Internal operations
- `adminIdeas`

## 13. Environment Variables And External Services
- `DATABASE_URL`: PostgreSQL connection.
- `SESSION_SECRET`: session signing key.
- `TEXTBELT_API_KEY`: SMS and OTP provider key (active implementation).
- `FOUNDER_PHONES`: founder phone list used in role elevation checks.
- `RESEND_API_KEY`: email OTP provider key.
- `EMAIL_FROM`: sender identity for outbound email.

## 14. API Change Policy
- This appendix is descriptive. No API contracts are modified by this document.
- Roadmap proposals in PRD are non-active until implementation.
