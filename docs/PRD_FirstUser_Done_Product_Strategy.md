# FirstUser `done` Product Requirements Document (PRD)

## Document Control
- Product: FirstUser
- Baseline: `/Users/christophercarmichael/Desktop/done`
- PRD style: Product strategy
- Scope: As-is product plus completion roadmap
- Last updated: 2026-02-06
- Primary audience: Product, design, engineering, and launch operations

## 1. Vision And Positioning
FirstUser turns passive waitlists into active product communities. Founders create branded AppSpaces where early adopters compete for position, earn status badges, and shape product direction through direct participation.

### Core promise
- Founders: Convert anonymous signups into engaged early users with structured moderation and communication tools.
- Early users: Get meaningful status, early access, and rewards for showing up early and contributing.
- Platform: Build a repeatable engagement loop that increases activation, retention, and founder confidence before launch.

### Positioning statement
FirstUser is a community-first waitlist platform for founders who want traction before launch, not just an email list.

## 2. Personas And Jobs-To-Be-Done

| Persona | Primary goals | Pain points | JTBD statement | Success signal |
|---|---|---|---|---|
| Founder / Community Operator | Launch an AppSpace, attract quality users, moderate participation, collect feedback | Dead waitlists, low response rates, manual moderation overhead | "When I launch early access, help me convert signups into an active community so I can ship with confidence." | Active approved members, steady conversation, useful feedback, reduced moderation burden |
| Early User / First Adopter | Discover promising products, join early, earn recognition, access founder interactions | Generic waitlists with no visibility or reward | "When I back a product early, help me prove I was early and get rewarded for meaningful participation." | Verified join, badge progression, active participation, repeat visits |
| Platform Admin (FirstUser internal) | Curate roadmap ideas, improve product quality, monitor engagement patterns | Unstructured feedback and no centralized backlog | "When I see demand and friction, give me a lightweight control plane to prioritize what to build next." | Admin ideas backlog quality, fast prioritization cycles, measurable improvements |

## 3. Product Scope (As-Is)

### In scope (implemented in `done`)
- Acquisition and discovery: landing and Explore surfaces.
- Authentication and onboarding: phone OTP, email OTP, username selection, profile completion.
- AppSpace creation: multi-step wizard with template support, image upload/crop, and draft autosave.
- Waitlist engine: join flow, position assignment, tier/reward framing, member state transitions.
- Community engagement: channel chat, DMs, reactions, unread tracking, message search.
- Founder tooling: moderation actions, bulk actions, announcements, polls, badge awards, founder stats.
- Notifications: in-app notification fetch/read/read-all.
- Product ops: admin ideas backlog.
- Realtime: Socket.IO presence, typing, channel and DM message delivery.

### Out of scope (not currently implemented)
- Explicit in-product browser error screenshot reporting flow.
- Full production observability stack (tracing, alerting, on-call automation).
- Comprehensive automated test suite.
- Large-scale reliability architecture (distributed OTP store, async fanout queues).

## 4. User Journey Narratives

### Journey A: New user to verified participant
1. User lands on public pages and explores AppSpaces.
2. User initiates auth via phone or email OTP.
3. User completes profile and username.
4. User joins an AppSpace waitlist.
5. User receives position and badge context.
6. User enters community spaces (read-only or full chat based on status/permissions).

### Journey B: Founder from setup to active moderation
1. Founder authenticates and opens CreateSpace.
2. Founder uses templates or custom inputs, uploads brand assets, and configures survey/rewards.
3. Founder publishes AppSpace and attracts members.
4. Founder moderates pending members (approve/reject/ban, including bulk actions).
5. Founder posts announcements, polls, and badge awards to drive engagement.
6. Founder monitors founder stats and iterates messaging.

### Journey C: Active member engagement loop
1. Approved member enters community channels.
2. Member participates in messages, DMs, reactions, and polls.
3. Member receives notifications and sees unread indicators.
4. Member returns for continued interaction and status progression.

### Journey D: Platform admin prioritization loop
1. Internal admin records product ideas in Admin Ideas panel.
2. Ideas move through backlog states.
3. Prioritized ideas feed roadmap cycles and release planning.

## 5. Functional Requirements By Module

### 5.1 Discovery and acquisition
- Users can browse public AppSpaces and filter/search in Explore.
- Public stats endpoint exposes lightweight topline data.
- Landing and discovery should direct users toward joining or creating communities.

### 5.2 Authentication and identity
- Support register/login/logout and session-based identity.
- Support OTP start/verify flows for both phone and email.
- Support username availability checks and username assignment.
- Persist authenticated state across app routes.

### 5.3 AppSpace creation and setup
- Multi-step CreateSpace wizard supports core setup fields.
- Wizard supports draft autosave, restore, and delete.
- Logo upload supports crop UX and server-side processing.
- Founder-configurable survey and badge/reward framing.

### 5.4 Waitlist lifecycle
- Assign and expose next position.
- Join waitlist for authenticated users.
- Founder moderation includes approve/reject/ban and bulk actions.
- Member lists and statuses are retrievable for founder operations.

### 5.5 Founder communications and activation
- Founder can publish and delete announcements.
- Founder can create polls and members can vote.
- Poll results are retrievable.
- Founder can create and award custom badges.

### 5.6 Community messaging
- Channel list and channel messages available per AppSpace.
- Authenticated users can post channel messages subject to membership restrictions.
- DMs support list/create/founder-init and message history/send.
- Message search and unread counts are available per AppSpace.

### 5.7 Engagement signals
- Members can add/remove/get emoji reactions.
- User channel read state updates unread count behavior.
- In-app notifications support list/read/read-all.

### 5.8 Product operations
- Admin ideas support create/read/update/delete for internal prioritization.

## 6. Roles, Permissions, And Access Rules

| Role | Access level | Examples |
|---|---|---|
| Unauthenticated | Public-only | View public AppSpace data, open auth flows |
| Authenticated user | Account and participation baseline | Join waitlists, edit profile/settings, send messages where allowed |
| Pending waitlist member | Restricted participation | Can view limited community context; chat/DM restrictions enforced in realtime and API checks |
| Approved member | Full member participation | Channel messaging, DMs, polls, reactions, notifications |
| Founder (AppSpace owner or founder-access account) | Community operation | Moderate members, publish announcements/polls, award badges, manage channels and founder settings |
| Platform admin (founder-access user) | Product ops | Manage Admin Ideas backlog and platform-level curation workflows |

### Permission model implementation notes
- Route guards include: `requireAuth`, `requireFounder`, `requireMember`, `requireApprovedMember`, `requireAppSpaceFounder`.
- CreateSpace route is additionally gated on phone verification in frontend protected routing.

## 7. Messaging And Engagement Layer

### Channel model
- AppSpaces contain channels with access flags (including waitlister-only and locked channels).
- Read/unread system tracks per-user per-channel read state.

### DM model
- Conversations and participants are persisted entities.
- Founder and member DM flows are supported via API and realtime transport.

### Reactions and search
- Emoji reactions can be added/removed and queried per message.
- Search endpoint returns messages scoped to AppSpace context.

### Realtime behavior
- Presence and typing indicators for channels and DMs.
- Realtime message fanout for channel and DM contexts.
- Realtime permission checks enforce membership/access constraints.

## 8. Founder Operations And Moderation
- Founder dashboard/tools include homepage settings, announcements, polls, badges, and member moderation.
- Founder can patch AppSpace settings and retrieve founder-specific stats.
- Member moderation includes single and bulk workflows.
- Announcement creation includes optional SMS broadcast behavior.

## 9. Growth And Retention Mechanics
- Waitlist position and badge framing establish status motivation.
- Community interactions (chat/DM/polls/reactions) create repeat touchpoints.
- Notification and unread systems drive return behavior.
- Founder-led announcements and polls maintain momentum.
- Profile completion and username capture improve social identity and persistence.

## 10. Platform Operations And Admin
- Draft persistence prevents setup abandonment in CreateSpace flow.
- Admin ideas backlog captures internal product signals and priorities.
- Founder-access controls provide lightweight internal operations capabilities.

## 11. Integrations And External Dependencies

### Communications
- SMS: TextBelt endpoints used for OTP and outbound SMS (`server/sms.ts` and route flows).
- Email OTP: Resend API integration via `server/email.ts`.

### Storage and runtime
- PostgreSQL via Drizzle ORM.
- Session persistence via PostgreSQL session store.
- Socket.IO for realtime interaction.

### Media pipeline
- `multer` for upload intake.
- `react-image-crop` for client crop interaction.
- `sharp` for server image resizing/conversion.

### Note on Twilio package
- `twilio` appears in dependencies, but current live auth/SMS flows are TextBelt-based in implementation.

## 12. Non-Functional Requirements

### Performance
- Core pages should be usable under normal network conditions without blocking on non-critical data.
- Messaging interactions should feel near-realtime for active channels/DMs.

### Reliability
- Critical auth flows (OTP start/verify) must be resilient and observable.
- Data writes for moderation and messaging should return deterministic success/error responses.

### Security and privacy
- Session-based auth and route guards must enforce role constraints.
- External messaging providers should only receive required delivery payloads.
- PII handling (phone/email) should follow least-privilege and audit-friendly logging practices.

### Operability
- Environment-driven configuration for external providers.
- Clear startup scripts for dev/prod and schema push.

## 13. Risks And Gaps (As-Is)
1. OTP persistence risk: OTP state is maintained in-process memory for key flows, which does not survive restarts and does not scale horizontally.
2. SMS provider signaling risk: TextBelt is active while Twilio dependency exists, which can create integration ambiguity.
3. Automated test gap: no strong test harness coverage for critical auth/moderation/messaging flows.
4. Missing explicit error screenshot reporting: no dedicated browser error screenshot capture/report feature found in current implementation.
5. Branch hygiene risk: local branch drift and non-product files in workspace can increase handoff complexity.
6. Launch operations gap: no fully documented production runbook/SLO package inside codebase.

## 14. Completion Roadmap

### Phase 1: Launch Readiness
- Objective: make current product launch-safe with minimal feature drift.
- Scope:
  - Move OTP state to durable shared store.
  - Standardize provider strategy for SMS/email and remove integration ambiguity.
  - Add critical path test coverage (auth, join/moderation, messaging).
  - Add baseline observability and error triage workflows.
  - Harden permission and abuse controls for key endpoints.
- Dependencies: infra support for shared state and monitoring, provider credentials, QA bandwidth.
- Acceptance gates:
  - Zero critical auth regressions in test matrix.
  - Durable OTP behavior validated across restart/failover scenarios.
  - Launch checklist items pass.

### Phase 2: Growth
- Objective: improve activation, retention, and founder productivity.
- Scope:
  - Improve onboarding funnel instrumentation and drop-off recovery.
  - Expand notification personalization and engagement prompts.
  - Improve founder analytics and moderation productivity tooling.
  - Improve discovery ranking and conversion UX.
- Dependencies: analytics instrumentation and product design iteration.
- Acceptance gates:
  - Measurable improvement in verified join and approved-to-active conversion.

### Phase 3: Scale Hardening
- Objective: prepare for higher concurrency and operational load.
- Scope:
  - Scale messaging/search architecture and fanout behavior.
  - Queue-based delivery for non-blocking notifications/SMS fanout.
  - SLO dashboards, alerting, and incident playbooks.
  - Data lifecycle and retention governance.
- Dependencies: infra budget, platform engineering allocation.
- Acceptance gates:
  - Service-level targets achieved under load testing and controlled rollout.

## 15. Success Metrics

### North-star metric
- Weekly active approved members per active AppSpace.

### Supporting metrics
- Acquisition and activation:
  - Visit-to-auth-start rate.
  - Auth-start to verified-user rate.
  - Verified-user to waitlist-join rate.
- Community health:
  - Approved-to-active member conversion.
  - Messages per active member.
  - Poll participation rate.
- Founder outcomes:
  - Time-to-first-10 approved members.
  - Moderation throughput and cycle time.
- Retention:
  - D7 and D30 retention for approved members.
- Engagement and comms:
  - Notification read rate.
  - Announcement click/read engagement.

## 16. Launch Readiness Checklist

### Security and auth
- [ ] Durable OTP storage implemented.
- [ ] Provider credentials and rotation policy documented.
- [ ] Permission checks validated across all founder/moderation endpoints.

### Product reliability
- [ ] Critical path regression suite passes.
- [ ] Messaging and DM flows validated for pending vs approved users.
- [ ] Draft autosave and restore behavior validated end-to-end.

### Data integrity
- [ ] Schema and storage mappings validated.
- [ ] Moderation, badges, polls, and notification writes are idempotent or safely retryable.

### Observability and ops
- [ ] Error logging and alerting in place for auth, messaging, and moderation failures.
- [ ] Launch runbook and rollback steps documented.

### UX quality
- [ ] Auth/onboarding funnel validated on desktop and mobile.
- [ ] Founder tools and community flows pass acceptance walkthroughs.

## 17. Appendices
- API inventory and realtime contracts: `/Users/christophercarmichael/Desktop/done/docs/PRD_FirstUser_Done_API_Appendix.md`
- Feature coverage matrix and schema mapping: `/Users/christophercarmichael/Desktop/done/docs/PRD_FirstUser_Done_Feature_Matrix.md`

### PRD validation scenarios
1. Every implemented API endpoint in `server/routes.ts` is represented in the API appendix.
2. Every table in `shared/schema.ts` maps to a capability or supporting function.
3. Founder happy path (auth -> create -> moderate -> publish) is fully documented.
4. Early user happy path (discover -> verify -> join -> participate) is fully documented.
5. Realtime event behavior is captured with constraints.
6. Role-gated actions are documented with explicit access assumptions.
7. Identified gaps include remediation direction in roadmap phases.
8. PRD claims align with source-of-truth files listed in this document.

### Change control
- No runtime API, interface, or schema changes are introduced by this PRD deliverable.
- Proposed roadmap items are forward-looking and non-active until explicitly implemented.

### Assumptions and defaults
1. PRD style is Product Strategy.
2. PRD scope is As-Is plus completion roadmap.
3. Canonical input is `/Users/christophercarmichael/Desktop/done` only.
4. Active SMS implementation is treated as TextBelt-based in current-state documentation.
5. Twilio package presence is documented as dependency state, not active flow.
6. Browser error screenshot capture is treated as a roadmap gap, not a current feature.
