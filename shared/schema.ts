import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
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
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

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
