import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(),
  email: text("email").unique(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  hasFounderAccess: boolean("has_founder_access").notNull().default(false),
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  title: text("title"),
  linkedInUrl: text("linkedin_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const appSpaces = pgTable("app_spaces", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("🚀"),
  category: text("category"),
  problemTitle: text("problem_title"),
  problemDescription: text("problem_description"),
  solutionTitle: text("solution_title"),
  solutionDescription: text("solution_description"),
  solutionPoints: text("solution_points"),
  founders: text("founders"),
  tierRewards: text("tier_rewards"),
  // Image uploads for homepage customization
  logoUrl: text("logo_url"),
  coverImageUrl: text("cover_image_url"),
  screenshots: text("screenshots"), // JSON array of screenshot URLs
  founderId: text("founder_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAppSpaceSchema = createInsertSchema(appSpaces).omit({
  id: true,
  createdAt: true,
});
export type InsertAppSpace = z.infer<typeof insertAppSpaceSchema>;
export type AppSpace = typeof appSpaces.$inferSelect;

export const waitlistMembers = pgTable("waitlist_members", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  userId: text("user_id").notNull().references(() => users.id),
  position: integer("position").notNull(),
  badgeTier: text("badge_tier").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  status: text("status").notNull().default("pending"),
  celebrated: boolean("celebrated").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertWaitlistMemberSchema = createInsertSchema(waitlistMembers).omit({
  id: true,
  joinedAt: true,
});
export type InsertWaitlistMember = z.infer<typeof insertWaitlistMemberSchema>;
export type WaitlistMember = typeof waitlistMembers.$inferSelect;

export const surveyQuestions = pgTable("survey_questions", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull().default("text"),
  options: text("options"),
  isRequired: boolean("is_required").notNull().default(false),
  displayOrder: integer("display_order").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSurveyQuestionSchema = createInsertSchema(surveyQuestions).omit({
  id: true,
  createdAt: true,
});
export type InsertSurveyQuestion = z.infer<typeof insertSurveyQuestionSchema>;
export type SurveyQuestion = typeof surveyQuestions.$inferSelect;

export const surveyResponses = pgTable("survey_responses", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  userId: text("user_id").notNull().references(() => users.id),
  questionId: integer("question_id").notNull().references(() => surveyQuestions.id),
  responseText: text("response_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSurveyResponseSchema = createInsertSchema(surveyResponses).omit({
  id: true,
  createdAt: true,
});
export type InsertSurveyResponse = z.infer<typeof insertSurveyResponseSchema>;
export type SurveyResponse = typeof surveyResponses.$inferSelect;

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  authorId: text("author_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
});
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

export const polls = pgTable("polls", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  authorId: text("author_id").notNull().references(() => users.id),
  question: text("question").notNull(),
  options: text("options").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  showResultsBeforeVoting: boolean("show_results_before_voting").notNull().default(false),
  allowMultipleVotes: boolean("allow_multiple_votes").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPollSchema = createInsertSchema(polls).omit({
  id: true,
  createdAt: true,
});
export type InsertPoll = z.infer<typeof insertPollSchema>;
export type Poll = typeof polls.$inferSelect;

export const pollVotes = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull().references(() => polls.id),
  userId: text("user_id").notNull().references(() => users.id),
  optionIndex: integer("option_index").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPollVoteSchema = createInsertSchema(pollVotes).omit({
  id: true,
  createdAt: true,
});
export type InsertPollVote = z.infer<typeof insertPollVoteSchema>;
export type PollVote = typeof pollVotes.$inferSelect;

export const customBadges = pgTable("custom_badges", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCustomBadgeSchema = createInsertSchema(customBadges).omit({
  id: true,
  createdAt: true,
});
export type InsertCustomBadge = z.infer<typeof insertCustomBadgeSchema>;
export type CustomBadge = typeof customBadges.$inferSelect;

export const badgeAwards = pgTable("badge_awards", {
  id: serial("id").primaryKey(),
  customBadgeId: integer("custom_badge_id").notNull().references(() => customBadges.id),
  userId: text("user_id").notNull().references(() => users.id),
  awardedBy: text("awarded_by").notNull().references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBadgeAwardSchema = createInsertSchema(badgeAwards).omit({
  id: true,
  createdAt: true,
});
export type InsertBadgeAward = z.infer<typeof insertBadgeAwardSchema>;
export type BadgeAward = typeof badgeAwards.$inferSelect;

// User settings for notification preferences
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id).unique(),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  smsNotifications: boolean("sms_notifications").notNull().default(true),
  pollReminders: boolean("poll_reminders").notNull().default(true),
  dmNotifications: boolean("dm_notifications").notNull().default(true),
  badgeAlerts: boolean("badge_alerts").notNull().default(true),
  showOnlineStatus: boolean("show_online_status").notNull().default(true),
  allowDmsFromAnyone: boolean("allow_dms_from_anyone").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

// OTP verification attempts and active verification records
export const authVerifications = pgTable("auth_verifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  method: text("method").notNull(), // phone | email
  target: text("target").notNull(), // normalized phone/email
  codeHash: text("code_hash").notNull(),
  ipAddress: text("ip_address"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  lockedUntil: timestamp("locked_until"),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAuthVerificationSchema = createInsertSchema(authVerifications).omit({
  id: true,
  attempts: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAuthVerification = z.infer<typeof insertAuthVerificationSchema>;
export type AuthVerification = typeof authVerifications.$inferSelect;

// Risk and trust events for auth and anti-fraud baselines
export const authRiskEvents = pgTable("auth_risk_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  method: text("method").notNull(), // phone | email
  target: text("target"),
  eventType: text("event_type").notNull(), // rate_limited | collision | lockout | suspicious_ip
  severity: text("severity").notNull().default("medium"), // low | medium | high | critical
  ipAddress: text("ip_address"),
  metadata: text("metadata"), // JSON payload
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuthRiskEventSchema = createInsertSchema(authRiskEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertAuthRiskEvent = z.infer<typeof insertAuthRiskEventSchema>;
export type AuthRiskEvent = typeof authRiskEvents.$inferSelect;

// Golden Ticket core table (exactly one winner per app space, service-contingent lifetime)
export const goldenTickets = pgTable("golden_tickets", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id).unique(),
  status: text("status").notNull().default("open"), // open | selected | closed
  winnerUserId: text("winner_user_id").references(() => users.id),
  selectedByUserId: text("selected_by_user_id").references(() => users.id),
  selectedAt: timestamp("selected_at"),
  selectionReason: text("selection_reason"),
  serviceContingent: boolean("service_contingent").notNull().default(true),
  nonTransferable: boolean("non_transferable").notNull().default(true),
  rateLimitedByPolicy: boolean("rate_limited_by_policy").notNull().default(true),
  winnerVisibility: text("winner_visibility").notNull().default("status_only"), // status_only
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGoldenTicketSchema = createInsertSchema(goldenTickets).omit({
  id: true,
  selectedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGoldenTicket = z.infer<typeof insertGoldenTicketSchema>;
export type GoldenTicket = typeof goldenTickets.$inferSelect;

// Configurable Golden Ticket tiers, minimum 3 required on publish
export const ticketTiers = pgTable("ticket_tiers", {
  id: serial("id").primaryKey(),
  goldenTicketId: integer("golden_ticket_id").notNull().references(() => goldenTickets.id),
  rank: integer("rank").notNull(),
  label: text("label").notNull(),
  reward: text("reward").notNull(),
  isLifetime: boolean("is_lifetime").notNull().default(false),
  benefits: text("benefits"), // JSON array of strings
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTicketTierSchema = createInsertSchema(ticketTiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTicketTier = z.infer<typeof insertTicketTierSchema>;
export type TicketTier = typeof ticketTiers.$inferSelect;

// Immutable audit trail for all Golden Ticket policy and winner lifecycle actions
export const ticketAuditEvents = pgTable("ticket_audit_events", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  goldenTicketId: integer("golden_ticket_id").notNull().references(() => goldenTickets.id),
  actorUserId: text("actor_user_id").references(() => users.id),
  eventType: text("event_type").notNull(), // policy_updated | tiers_updated | winner_selected | policy_reported | policy_resolved
  eventData: text("event_data"), // JSON payload
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTicketAuditEventSchema = createInsertSchema(ticketAuditEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertTicketAuditEvent = z.infer<typeof insertTicketAuditEventSchema>;
export type TicketAuditEvent = typeof ticketAuditEvents.$inferSelect;

// Policy/fraud report lifecycle events
export const ticketPolicyEvents = pgTable("ticket_policy_events", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  goldenTicketId: integer("golden_ticket_id").notNull().references(() => goldenTickets.id),
  reporterUserId: text("reporter_user_id").notNull().references(() => users.id),
  category: text("category").notNull(), // policy_breach | fraud
  description: text("description").notNull(),
  status: text("status").notNull().default("open"), // open | investigating | resolved | rejected
  resolution: text("resolution"),
  resolvedByUserId: text("resolved_by_user_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTicketPolicyEventSchema = createInsertSchema(ticketPolicyEvents).omit({
  id: true,
  resolution: true,
  resolvedByUserId: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTicketPolicyEvent = z.infer<typeof insertTicketPolicyEventSchema>;
export type TicketPolicyEvent = typeof ticketPolicyEvents.$inferSelect;

// Channels for real-time chat
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("chat"), // "chat" | "forum"
  isLocked: boolean("is_locked").notNull().default(false), // approved members only
  isWaitlistersOnly: boolean("is_waitlisters_only").notNull().default(false), // pending members only
  isReadOnly: boolean("is_read_only").notNull().default(false), // founder posts only
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
  createdAt: true,
});
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channels.$inferSelect;

// Chat messages
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channels.id),
  userId: text("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// DM Conversations (DM threads between users within an app space)
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Conversation participants
export const conversationParticipants = pgTable("conversation_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  userId: text("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertConversationParticipantSchema = createInsertSchema(conversationParticipants).omit({
  id: true,
  joinedAt: true,
});
export type InsertConversationParticipant = z.infer<typeof insertConversationParticipantSchema>;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;

// Direct messages
export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  senderId: text("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;

// User channel read tracking for unread counts
export const userChannelRead = pgTable("user_channel_read", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  channelId: integer("channel_id").notNull().references(() => channels.id),
  lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
});

export const insertUserChannelReadSchema = createInsertSchema(userChannelRead).omit({
  id: true,
});
export type InsertUserChannelRead = z.infer<typeof insertUserChannelReadSchema>;
export type UserChannelRead = typeof userChannelRead.$inferSelect;

// Notifications table for @ mentions and other notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // "mention", "dm", "channel_message", "approval"
  data: text("data").notNull(), // JSON string with notification details
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Live visibility preferences for founder radar
export const userLivePreferences = pgTable("user_live_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id).unique(),
  showLiveToFounders: boolean("show_live_to_founders").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserLivePreferenceSchema = createInsertSchema(userLivePreferences).omit({
  id: true,
  updatedAt: true,
});
export type InsertUserLivePreference = z.infer<typeof insertUserLivePreferenceSchema>;
export type UserLivePreference = typeof userLivePreferences.$inferSelect;

// Live presence heartbeat state for integrations
export const livePresence = pgTable("live_presence", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  userId: text("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("offline"), // live | idle | offline
  clientPlatform: text("client_platform").notNull().default("web"),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  appSpaceUserUnique: unique("live_presence_app_space_user_unique").on(table.appSpaceId, table.userId),
}));

export const insertLivePresenceSchema = createInsertSchema(livePresence).omit({
  id: true,
  updatedAt: true,
});
export type InsertLivePresence = z.infer<typeof insertLivePresenceSchema>;
export type LivePresence = typeof livePresence.$inferSelect;

// Founder-member live chat threads scoped to an app space
export const liveChatThreads = pgTable("live_chat_threads", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  founderUserId: text("founder_user_id").notNull().references(() => users.id),
  memberUserId: text("member_user_id").notNull().references(() => users.id),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  appFounderMemberUnique: unique("live_chat_threads_app_founder_member_unique").on(
    table.appSpaceId,
    table.founderUserId,
    table.memberUserId
  ),
}));

export const insertLiveChatThreadSchema = createInsertSchema(liveChatThreads).omit({
  id: true,
  openedAt: true,
  lastMessageAt: true,
  createdAt: true,
});
export type InsertLiveChatThread = z.infer<typeof insertLiveChatThreadSchema>;
export type LiveChatThread = typeof liveChatThreads.$inferSelect;

// Messages exchanged in founder live chat threads
export const liveChatMessages = pgTable("live_chat_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => liveChatThreads.id),
  senderUserId: text("sender_user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
});

export const insertLiveChatMessageSchema = createInsertSchema(liveChatMessages).omit({
  id: true,
  createdAt: true,
  readAt: true,
});
export type InsertLiveChatMessage = z.infer<typeof insertLiveChatMessageSchema>;
export type LiveChatMessage = typeof liveChatMessages.$inferSelect;

// Partner integration app configuration (one per AppSpace for v1)
export const integrationApps = pgTable("integration_apps", {
  id: serial("id").primaryKey(),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id).unique(),
  publicAppId: text("public_app_id").notNull().unique(),
  redirectEnabled: boolean("redirect_enabled").notNull().default(true),
  embeddedEnabled: boolean("embedded_enabled").notNull().default(false),
  webRedirectUrl: text("web_redirect_url"),
  mobileDeepLinkUrl: text("mobile_deep_link_url"),
  allowedOrigins: text("allowed_origins").notNull().default("[]"), // JSON array string
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIntegrationAppSchema = createInsertSchema(integrationApps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntegrationApp = z.infer<typeof insertIntegrationAppSchema>;
export type IntegrationApp = typeof integrationApps.$inferSelect;

// Rotatable server-to-server key credentials for partner apps
export const integrationApiKeys = pgTable("integration_api_keys", {
  id: serial("id").primaryKey(),
  integrationAppId: integer("integration_app_id").notNull().references(() => integrationApps.id),
  keyId: text("key_id").notNull().unique(),
  secretHash: text("secret_hash").notNull(),
  lastFour: text("last_four").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

export const insertIntegrationApiKeySchema = createInsertSchema(integrationApiKeys).omit({
  id: true,
  createdAt: true,
  revokedAt: true,
});
export type InsertIntegrationApiKey = z.infer<typeof insertIntegrationApiKeySchema>;
export type IntegrationApiKey = typeof integrationApiKeys.$inferSelect;

// One-time access codes used for partner auto-login/deep-link exchange
export const integrationAccessCodes = pgTable("integration_access_codes", {
  id: serial("id").primaryKey(),
  integrationAppId: integer("integration_app_id").notNull().references(() => integrationApps.id),
  firstuserUserId: text("firstuser_user_id").notNull().references(() => users.id),
  appSpaceId: integer("app_space_id").notNull().references(() => appSpaces.id),
  codeHash: text("code_hash").notNull(),
  status: text("status").notNull().default("issued"), // issued | redeemed | expired
  expiresAt: timestamp("expires_at").notNull(),
  redeemedAt: timestamp("redeemed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIntegrationAccessCodeSchema = createInsertSchema(integrationAccessCodes).omit({
  id: true,
  redeemedAt: true,
  createdAt: true,
});
export type InsertIntegrationAccessCode = z.infer<typeof insertIntegrationAccessCodeSchema>;
export type IntegrationAccessCode = typeof integrationAccessCodes.$inferSelect;

// Mapping between FirstUser identity and partner app identity
export const integrationIdentityLinks = pgTable("integration_identity_links", {
  id: serial("id").primaryKey(),
  integrationAppId: integer("integration_app_id").notNull().references(() => integrationApps.id),
  firstuserUserId: text("firstuser_user_id").notNull().references(() => users.id),
  externalUserId: text("external_user_id").notNull(),
  currentPlanTier: text("current_plan_tier").notNull().default("free"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  integrationExternalUnique: unique("integration_identity_links_integration_external_unique").on(
    table.integrationAppId,
    table.externalUserId,
  ),
  integrationFirstUserUnique: unique("integration_identity_links_integration_firstuser_unique").on(
    table.integrationAppId,
    table.firstuserUserId,
  ),
}));

export const insertIntegrationIdentityLinkSchema = createInsertSchema(integrationIdentityLinks).omit({
  id: true,
  updatedAt: true,
});
export type InsertIntegrationIdentityLink = z.infer<typeof insertIntegrationIdentityLinkSchema>;
export type IntegrationIdentityLink = typeof integrationIdentityLinks.$inferSelect;

// Coarse session tracking from partner heartbeat stream
export const integrationUsageSessions = pgTable("integration_usage_sessions", {
  id: serial("id").primaryKey(),
  integrationAppId: integer("integration_app_id").notNull().references(() => integrationApps.id),
  firstuserUserId: text("firstuser_user_id").notNull().references(() => users.id),
  membershipStatus: text("membership_status").notNull(), // pending | approved
  clientPlatform: text("client_platform").notNull().default("web"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds"),
});

export const insertIntegrationUsageSessionSchema = createInsertSchema(integrationUsageSessions).omit({
  id: true,
  endedAt: true,
  durationSeconds: true,
});
export type InsertIntegrationUsageSession = z.infer<typeof insertIntegrationUsageSessionSchema>;
export type IntegrationUsageSession = typeof integrationUsageSessions.$inferSelect;

// Outbound webhook delivery logs for partner callbacks
export const integrationWebhookDeliveries = pgTable("integration_webhook_deliveries", {
  id: serial("id").primaryKey(),
  integrationAppId: integer("integration_app_id").notNull().references(() => integrationApps.id),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(),
  signature: text("signature").notNull(),
  attempt: integer("attempt").notNull().default(1),
  status: text("status").notNull().default("pending"), // pending | delivered | failed
  nextRetryAt: timestamp("next_retry_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIntegrationWebhookDeliverySchema = createInsertSchema(integrationWebhookDeliveries).omit({
  id: true,
  createdAt: true,
});
export type InsertIntegrationWebhookDelivery = z.infer<typeof insertIntegrationWebhookDeliverySchema>;
export type IntegrationWebhookDelivery = typeof integrationWebhookDeliveries.$inferSelect;

// Message reactions
export const messageReactions = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => chatMessages.id),
  userId: text("user_id").notNull().references(() => users.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageReactionSchema = createInsertSchema(messageReactions).omit({
  id: true,
  createdAt: true,
});
export type InsertMessageReaction = z.infer<typeof insertMessageReactionSchema>;
export type MessageReaction = typeof messageReactions.$inferSelect;

// AppSpace drafts for auto-save
export const appSpaceDrafts = pgTable("app_space_drafts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id).unique(),
  data: text("data").notNull(), // JSON string with draft data
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAppSpaceDraftSchema = createInsertSchema(appSpaceDrafts).omit({
  id: true,
  updatedAt: true,
});
export type InsertAppSpaceDraft = z.infer<typeof insertAppSpaceDraftSchema>;
export type AppSpaceDraft = typeof appSpaceDrafts.$inferSelect;

// Admin ideas backlog
export const adminIdeas = pgTable("admin_ideas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  status: text("status").notNull().default("idea"), // idea, planned, in_progress, completed, rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAdminIdeaSchema = createInsertSchema(adminIdeas).omit({
  id: true,
  createdAt: true,
});
export type InsertAdminIdea = z.infer<typeof insertAdminIdeaSchema>;
export type AdminIdea = typeof adminIdeas.$inferSelect;

// Re-export sessions table for Replit Auth
export { sessions } from "./models/auth";
