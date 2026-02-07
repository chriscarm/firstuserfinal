import { db } from "./db";
import {
  users,
  appSpaces,
  waitlistMembers,
  surveyQuestions,
  surveyResponses,
  announcements,
  polls,
  pollVotes,
  customBadges,
  badgeAwards,
  userSettings,
  channels,
  chatMessages,
  conversations,
  conversationParticipants,
  directMessages,
  userChannelRead,
  notifications,
  messageReactions,
  appSpaceDrafts,
  adminIdeas,
  authVerifications,
  authRiskEvents,
  goldenTickets,
  ticketTiers,
  ticketAuditEvents,
  ticketPolicyEvents,
  type User,
  type InsertUser,
  type AppSpace,
  type InsertAppSpace,
  type WaitlistMember,
  type InsertWaitlistMember,
  type SurveyQuestion,
  type InsertSurveyQuestion,
  type SurveyResponse,
  type InsertSurveyResponse,
  type Announcement,
  type InsertAnnouncement,
  type Poll,
  type InsertPoll,
  type PollVote,
  type InsertPollVote,
  type CustomBadge,
  type InsertCustomBadge,
  type BadgeAward,
  type InsertBadgeAward,
  type UserSettings,
  type InsertUserSettings,
  type Channel,
  type InsertChannel,
  type ChatMessage,
  type InsertChatMessage,
  type Conversation,
  type InsertConversation,
  type ConversationParticipant,
  type InsertConversationParticipant,
  type DirectMessage,
  type InsertDirectMessage,
  type UserChannelRead,
  type InsertUserChannelRead,
  type Notification,
  type InsertNotification,
  type MessageReaction,
  type InsertMessageReaction,
  type AppSpaceDraft,
  type InsertAppSpaceDraft,
  type AdminIdea,
  type InsertAdminIdea,
  type AuthVerification,
  type InsertAuthVerification,
  type AuthRiskEvent,
  type InsertAuthRiskEvent,
  type GoldenTicket,
  type InsertGoldenTicket,
  type TicketTier,
  type InsertTicketTier,
  type TicketAuditEvent,
  type InsertTicketAuditEvent,
  type TicketPolicyEvent,
  type InsertTicketPolicyEvent,
} from "@shared/schema";
import { eq, sql, desc, and, asc, count, gt, lt, inArray, gte, or } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: { email: string; password: string }): Promise<User>;
  createUserFromPhone(phone: string): Promise<User>;
  updateUserPhone(userId: string, phone: string): Promise<User>;
  verifyUserPhone(userId: string, grantFounderAccess: boolean): Promise<User>;
  setUsername(userId: string, username: string): Promise<User>;
  grantFounderAccess(userId: string): Promise<User>;
  
  getAppSpace(id: number): Promise<AppSpace | undefined>;
  getAppSpaceBySlug(slug: string): Promise<AppSpace | undefined>;
  getAllAppSpaces(): Promise<AppSpace[]>;
  createAppSpace(appSpace: InsertAppSpace): Promise<AppSpace>;
  
  getWaitlistMember(appSpaceId: number, userId: string): Promise<WaitlistMember | undefined>;
  getWaitlistMembers(appSpaceId: number): Promise<WaitlistMember[]>;
  getNextPosition(appSpaceId: number): Promise<number>;
  joinWaitlist(member: InsertWaitlistMember): Promise<WaitlistMember>;

  getSurveyQuestions(appSpaceId: number): Promise<SurveyQuestion[]>;
  createSurveyQuestion(question: InsertSurveyQuestion): Promise<SurveyQuestion>;
  saveSurveyResponses(responses: InsertSurveyResponse[]): Promise<SurveyResponse[]>;
  
  getUncelebratedBadges(userId: string): Promise<Array<WaitlistMember & { appName: string; appLogo?: string }>>;
  markBadgeCelebrated(badgeId: number): Promise<WaitlistMember>;
  
  updateWaitlistMemberStatus(appSpaceId: number, userId: string, status: string): Promise<WaitlistMember>;
  setWaitlistMemberActive(appSpaceId: number, userId: string, isActive: boolean): Promise<WaitlistMember>;
  getWaitlistMembersWithUsers(appSpaceId: number): Promise<Array<WaitlistMember & { username: string | null; email: string | null; phoneVerified: boolean }>>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    // Normalize phone number for comparison (remove all non-digits)
    const normalizedPhone = phone.replace(/\D/g, "");
    const result = await db.select().from(users).where(eq(users.phone, normalizedPhone)).limit(1);
    return result[0];
  }

  async countUsersByPhone(phone: string): Promise<number> {
    const normalizedPhone = phone.replace(/\D/g, "");
    const result = await db.select({ count: count() }).from(users).where(eq(users.phone, normalizedPhone));
    return result[0]?.count ?? 0;
  }

  async countUsersByEmail(email: string): Promise<number> {
    const normalizedEmail = email.toLowerCase().trim();
    const result = await db.select({ count: count() }).from(users).where(eq(users.email, normalizedEmail));
    return result[0]?.count ?? 0;
  }

  async createUser(insertUser: { email: string; password: string }): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createUserFromPhone(phone: string): Promise<User> {
    // Normalize phone number (remove all non-digits)
    const normalizedPhone = phone.replace(/\D/g, "");
    const result = await db.insert(users).values({
      phone: normalizedPhone,
      phoneVerified: false
    }).returning();
    return result[0];
  }

  async updateUserPhone(userId: string, phone: string): Promise<User> {
    const result = await db.update(users)
      .set({ phone })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async verifyUserPhone(userId: string, grantFounderAccess: boolean): Promise<User> {
    const updateData: { phoneVerified: boolean; hasFounderAccess?: boolean } = { phoneVerified: true };
    if (grantFounderAccess) {
      updateData.hasFounderAccess = true;
    }
    const result = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async setUsername(userId: string, username: string): Promise<User> {
    const result = await db.update(users)
      .set({ username })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUser(userId: string, data: Partial<Omit<User, "id" | "createdAt">>): Promise<User> {
    const result = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserProfile(userId: string, profile: { firstName?: string | null; lastName?: string | null; displayName?: string | null; title?: string | null; linkedInUrl?: string | null; avatarUrl?: string | null }): Promise<User> {
    // Filter out undefined values to only update provided fields
    const updateData: Record<string, string | null> = {};
    if (profile.firstName !== undefined) updateData.firstName = profile.firstName;
    if (profile.lastName !== undefined) updateData.lastName = profile.lastName;
    if (profile.displayName !== undefined) updateData.displayName = profile.displayName;
    if (profile.title !== undefined) updateData.title = profile.title;
    if (profile.linkedInUrl !== undefined) updateData.linkedInUrl = profile.linkedInUrl;
    if (profile.avatarUrl !== undefined) updateData.avatarUrl = profile.avatarUrl;

    const result = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async getAppSpace(id: number): Promise<AppSpace | undefined> {
    const result = await db.select().from(appSpaces).where(eq(appSpaces.id, id)).limit(1);
    return result[0];
  }

  async getAppSpaceBySlug(slug: string): Promise<AppSpace | undefined> {
    const result = await db.select().from(appSpaces).where(eq(appSpaces.slug, slug)).limit(1);
    return result[0];
  }

  async getAllAppSpaces(): Promise<AppSpace[]> {
    return await db.select().from(appSpaces).orderBy(desc(appSpaces.createdAt));
  }

  async createAppSpace(insertAppSpace: InsertAppSpace): Promise<AppSpace> {
    const result = await db.insert(appSpaces).values(insertAppSpace).returning();
    return result[0];
  }

  async getWaitlistMember(appSpaceId: number, userId: string): Promise<WaitlistMember | undefined> {
    const result = await db.select().from(waitlistMembers)
      .where(sql`${waitlistMembers.appSpaceId} = ${appSpaceId} AND ${waitlistMembers.userId} = ${userId}`)
      .limit(1);
    return result[0];
  }

  async getWaitlistMembers(appSpaceId: number): Promise<WaitlistMember[]> {
    return await db.select().from(waitlistMembers)
      .where(eq(waitlistMembers.appSpaceId, appSpaceId))
      .orderBy(waitlistMembers.position);
  }

  async getNextPosition(appSpaceId: number): Promise<number> {
    const result = await db.select({ maxPos: sql<number>`COALESCE(MAX(${waitlistMembers.position}), 0)` })
      .from(waitlistMembers)
      .where(eq(waitlistMembers.appSpaceId, appSpaceId));
    return (result[0]?.maxPos ?? 0) + 1;
  }

  async joinWaitlist(insertMember: InsertWaitlistMember): Promise<WaitlistMember> {
    const result = await db.insert(waitlistMembers).values(insertMember).returning();
    return result[0];
  }

  async grantFounderAccess(userId: string): Promise<User> {
    const result = await db.update(users)
      .set({ hasFounderAccess: true })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async getSurveyQuestions(appSpaceId: number): Promise<SurveyQuestion[]> {
    return await db.select().from(surveyQuestions)
      .where(eq(surveyQuestions.appSpaceId, appSpaceId))
      .orderBy(surveyQuestions.displayOrder);
  }

  async createSurveyQuestion(question: InsertSurveyQuestion): Promise<SurveyQuestion> {
    const result = await db.insert(surveyQuestions).values(question).returning();
    return result[0];
  }

  async saveSurveyResponses(responses: InsertSurveyResponse[]): Promise<SurveyResponse[]> {
    if (responses.length === 0) return [];
    const result = await db.insert(surveyResponses).values(responses).returning();
    return result;
  }

  async getUncelebratedBadges(userId: string): Promise<Array<WaitlistMember & { appName: string; appLogo?: string }>> {
    const result = await db.select({
      id: waitlistMembers.id,
      appSpaceId: waitlistMembers.appSpaceId,
      userId: waitlistMembers.userId,
      position: waitlistMembers.position,
      badgeTier: waitlistMembers.badgeTier,
      isActive: waitlistMembers.isActive,
      status: waitlistMembers.status,
      celebrated: waitlistMembers.celebrated,
      joinedAt: waitlistMembers.joinedAt,
      appName: appSpaces.name,
    })
    .from(waitlistMembers)
    .innerJoin(appSpaces, eq(waitlistMembers.appSpaceId, appSpaces.id))
    .where(and(
      eq(waitlistMembers.userId, userId),
      eq(waitlistMembers.celebrated, false)
    ))
    .orderBy(desc(waitlistMembers.joinedAt));
    return result;
  }

  async markBadgeCelebrated(badgeId: number): Promise<WaitlistMember> {
    const result = await db.update(waitlistMembers)
      .set({ celebrated: true })
      .where(eq(waitlistMembers.id, badgeId))
      .returning();
    return result[0];
  }

  async updateWaitlistMemberStatus(appSpaceId: number, userId: string, status: string): Promise<WaitlistMember> {
    const result = await db.update(waitlistMembers)
      .set({ status })
      .where(sql`${waitlistMembers.appSpaceId} = ${appSpaceId} AND ${waitlistMembers.userId} = ${userId}`)
      .returning();
    return result[0];
  }

  async setWaitlistMemberActive(appSpaceId: number, userId: string, isActive: boolean): Promise<WaitlistMember> {
    const result = await db.update(waitlistMembers)
      .set({ isActive })
      .where(sql`${waitlistMembers.appSpaceId} = ${appSpaceId} AND ${waitlistMembers.userId} = ${userId}`)
      .returning();
    return result[0];
  }

  async getWaitlistMembersWithUsers(appSpaceId: number): Promise<Array<WaitlistMember & { username: string | null; email: string | null; phoneVerified: boolean }>> {
    const result = await db.select({
      id: waitlistMembers.id,
      appSpaceId: waitlistMembers.appSpaceId,
      userId: waitlistMembers.userId,
      position: waitlistMembers.position,
      badgeTier: waitlistMembers.badgeTier,
      isActive: waitlistMembers.isActive,
      status: waitlistMembers.status,
      celebrated: waitlistMembers.celebrated,
      joinedAt: waitlistMembers.joinedAt,
      username: users.username,
      email: users.email,
      phoneVerified: users.phoneVerified,
    })
    .from(waitlistMembers)
    .innerJoin(users, eq(waitlistMembers.userId, users.id))
    .where(eq(waitlistMembers.appSpaceId, appSpaceId))
    .orderBy(waitlistMembers.position);
    return result;
  }

  async getAnnouncements(appSpaceId: number): Promise<Announcement[]> {
    return await db.select().from(announcements)
      .where(eq(announcements.appSpaceId, appSpaceId))
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt));
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const result = await db.insert(announcements).values(announcement).returning();
    return result[0];
  }

  async deleteAnnouncement(id: number, appSpaceId: number): Promise<boolean> {
    const result = await db.delete(announcements)
      .where(and(eq(announcements.id, id), eq(announcements.appSpaceId, appSpaceId)))
      .returning();
    return result.length > 0;
  }

  async getPolls(appSpaceId: number): Promise<Poll[]> {
    return await db.select().from(polls)
      .where(eq(polls.appSpaceId, appSpaceId))
      .orderBy(desc(polls.createdAt));
  }

  async getPoll(id: number): Promise<Poll | undefined> {
    const result = await db.select().from(polls).where(eq(polls.id, id)).limit(1);
    return result[0];
  }

  async createPoll(poll: InsertPoll): Promise<Poll> {
    const result = await db.insert(polls).values(poll).returning();
    return result[0];
  }

  async getPollVotes(pollId: number): Promise<PollVote[]> {
    return await db.select().from(pollVotes).where(eq(pollVotes.pollId, pollId));
  }

  async getUserPollVotes(pollId: number, userId: string): Promise<PollVote[]> {
    return await db.select().from(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));
  }

  async createPollVote(vote: InsertPollVote): Promise<PollVote> {
    const result = await db.insert(pollVotes).values(vote).returning();
    return result[0];
  }

  async getCustomBadges(appSpaceId: number): Promise<CustomBadge[]> {
    return await db.select().from(customBadges)
      .where(eq(customBadges.appSpaceId, appSpaceId))
      .orderBy(asc(customBadges.createdAt));
  }

  async createCustomBadge(badge: InsertCustomBadge): Promise<CustomBadge> {
    const result = await db.insert(customBadges).values(badge).returning();
    return result[0];
  }

  async getBadgeAwards(customBadgeId: number): Promise<BadgeAward[]> {
    return await db.select().from(badgeAwards)
      .where(eq(badgeAwards.customBadgeId, customBadgeId))
      .orderBy(desc(badgeAwards.createdAt));
  }

  async getUserBadgeAwards(userId: string): Promise<Array<BadgeAward & { badgeName: string; badgeIcon: string }>> {
    const result = await db.select({
      id: badgeAwards.id,
      customBadgeId: badgeAwards.customBadgeId,
      userId: badgeAwards.userId,
      awardedBy: badgeAwards.awardedBy,
      reason: badgeAwards.reason,
      createdAt: badgeAwards.createdAt,
      badgeName: customBadges.name,
      badgeIcon: customBadges.icon,
    })
    .from(badgeAwards)
    .innerJoin(customBadges, eq(badgeAwards.customBadgeId, customBadges.id))
    .where(eq(badgeAwards.userId, userId))
    .orderBy(desc(badgeAwards.createdAt));
    return result;
  }

  async awardBadge(award: InsertBadgeAward): Promise<BadgeAward> {
    const result = await db.insert(badgeAwards).values(award).returning();
    return result[0];
  }

  async getCustomBadgeAwardCount(customBadgeId: number): Promise<number> {
    const result = await db.select({ count: count() })
      .from(badgeAwards)
      .where(eq(badgeAwards.customBadgeId, customBadgeId));
    return result[0]?.count ?? 0;
  }

  async getVerifiedPhoneUsersCount(appSpaceId: number): Promise<number> {
    const result = await db.select({ count: count() })
      .from(waitlistMembers)
      .innerJoin(users, eq(waitlistMembers.userId, users.id))
      .where(and(
        eq(waitlistMembers.appSpaceId, appSpaceId),
        eq(users.phoneVerified, true)
      ));
    return result[0]?.count ?? 0;
  }

  async getTotalWaitlistMembers(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(waitlistMembers);
    return result[0]?.count || 0;
  }

  async getRecentAnnouncements(limit: number): Promise<Announcement[]> {
    return db.select().from(announcements)
      .orderBy(desc(announcements.createdAt))
      .limit(limit);
  }

  async getUserWaitlistMemberships(userId: string) {
    return db.select({
      id: waitlistMembers.id,
      appSpaceId: waitlistMembers.appSpaceId,
      position: waitlistMembers.position,
      status: waitlistMembers.status,
      joinedAt: waitlistMembers.joinedAt,
      appSpaceName: appSpaces.name,
      appSpaceSlug: appSpaces.slug
    })
    .from(waitlistMembers)
    .innerJoin(appSpaces, eq(waitlistMembers.appSpaceId, appSpaces.id))
    .where(eq(waitlistMembers.userId, userId));
  }

  async getActiveUsers(appSpaceId: number, limit: number = 20) {
    return db.select({
      id: waitlistMembers.id,
      userId: waitlistMembers.userId,
      position: waitlistMembers.position,
      badgeTier: waitlistMembers.badgeTier,
      isActive: waitlistMembers.isActive,
      status: waitlistMembers.status,
      joinedAt: waitlistMembers.joinedAt,
      user: {
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(waitlistMembers)
    .innerJoin(users, eq(waitlistMembers.userId, users.id))
    .where(and(
      eq(waitlistMembers.appSpaceId, appSpaceId),
      eq(waitlistMembers.status, "approved")
    ))
    .orderBy(waitlistMembers.position)
    .limit(limit);
  }

  async getWaitlistUsers(appSpaceId: number, limit: number = 20) {
    return db.select({
      id: waitlistMembers.id,
      userId: waitlistMembers.userId,
      position: waitlistMembers.position,
      badgeTier: waitlistMembers.badgeTier,
      isActive: waitlistMembers.isActive,
      status: waitlistMembers.status,
      joinedAt: waitlistMembers.joinedAt,
      user: {
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(waitlistMembers)
    .innerJoin(users, eq(waitlistMembers.userId, users.id))
    .where(and(
      eq(waitlistMembers.appSpaceId, appSpaceId),
      eq(waitlistMembers.status, "pending")
    ))
    .orderBy(waitlistMembers.position)
    .limit(limit);
  }

  async getActiveCount(appSpaceId: number) {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(waitlistMembers)
      .where(and(
        eq(waitlistMembers.appSpaceId, appSpaceId),
        eq(waitlistMembers.status, "approved")
      ));
    return result[0]?.count || 0;
  }

  async getWaitlistCount(appSpaceId: number) {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(waitlistMembers)
      .where(and(
        eq(waitlistMembers.appSpaceId, appSpaceId),
        eq(waitlistMembers.status, "pending")
      ));
    return result[0]?.count || 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateAppSpace(id: number, updates: Partial<{
    name: string;
    tagline: string;
    description: string;
    icon: string;
    category: string;
    problemTitle: string;
    problemDescription: string;
    solutionTitle: string;
    solutionDescription: string;
    solutionPoints: string;
    founders: string;
    tierRewards: string;
    logoUrl: string;
    coverImageUrl: string;
    screenshots: string;
  }>): Promise<AppSpace> {
    const result = await db.update(appSpaces)
      .set(updates)
      .where(eq(appSpaces.id, id))
      .returning();
    return result[0];
  }

  async updateWaitlistMemberBadge(appSpaceId: number, userId: string, badgeTier: string): Promise<WaitlistMember> {
    const result = await db.update(waitlistMembers)
      .set({ badgeTier })
      .where(and(
        eq(waitlistMembers.appSpaceId, appSpaceId),
        eq(waitlistMembers.userId, userId)
      ))
      .returning();
    return result[0];
  }

  // User Settings methods
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
    return result[0];
  }

  async saveUserSettings(userId: string, settings: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    pollReminders?: boolean;
    dmNotifications?: boolean;
    badgeAlerts?: boolean;
    showOnlineStatus?: boolean;
    allowDmsFromAnyone?: boolean;
  }): Promise<UserSettings> {
    const existing = await this.getUserSettings(userId);
    if (existing) {
      const result = await db.update(userSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(userSettings)
        .values({
          userId,
          emailNotifications: settings.emailNotifications ?? true,
          smsNotifications: settings.smsNotifications ?? true,
          pollReminders: settings.pollReminders ?? true,
          dmNotifications: settings.dmNotifications ?? true,
          badgeAlerts: settings.badgeAlerts ?? true,
          showOnlineStatus: settings.showOnlineStatus ?? true,
          allowDmsFromAnyone: settings.allowDmsFromAnyone ?? false,
        })
        .returning();
      return result[0];
    }
  }

  // Channel methods
  async getChannels(appSpaceId: number): Promise<Channel[]> {
    return db.select().from(channels)
      .where(eq(channels.appSpaceId, appSpaceId))
      .orderBy(asc(channels.createdAt));
  }

  async getChannel(channelId: number): Promise<Channel | undefined> {
    const result = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    return result[0];
  }

  async createChannel(channel: InsertChannel): Promise<Channel> {
    const result = await db.insert(channels).values(channel).returning();
    return result[0];
  }

  async createDefaultChannels(appSpaceId: number): Promise<Channel[]> {
    const defaultChannels: InsertChannel[] = [
      // Waitlist-only (pending users can access)
      { appSpaceId, name: "let-me-in-already", description: "Chat while you wait", type: "chat", isWaitlistersOnly: true },
      { appSpaceId, name: "what-i-gotta-do", description: "Tips for getting accepted", type: "chat", isWaitlistersOnly: true },
      // Members-only (approved users)
      { appSpaceId, name: "general", description: "General discussion", type: "chat", isLocked: true },
      { appSpaceId, name: "announcements", description: "Official updates", type: "chat", isLocked: true, isReadOnly: true },
      { appSpaceId, name: "introductions", description: "Say hi to the community", type: "chat", isLocked: true },
      { appSpaceId, name: "feedback", description: "Share your thoughts", type: "chat", isLocked: true },
      { appSpaceId, name: "get-free-gear", description: "Perks and rewards", type: "chat", isLocked: true },
    ];
    const result = await db.insert(channels).values(defaultChannels).returning();
    return result;
  }

  // Chat message methods
  async getMessages(channelId: number, limit: number = 50, before?: number): Promise<Array<ChatMessage & { user: { id: string; username: string | null; displayName: string | null; avatarUrl: string | null } }>> {
    let query = db.select({
      id: chatMessages.id,
      channelId: chatMessages.channelId,
      userId: chatMessages.userId,
      content: chatMessages.content,
      isPinned: chatMessages.isPinned,
      createdAt: chatMessages.createdAt,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      }
    })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.userId, users.id))
    .where(before ? and(eq(chatMessages.channelId, channelId), lt(chatMessages.id, before)) : eq(chatMessages.channelId, channelId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

    const result = await query;
    return result.reverse(); // Return oldest first
  }

  async createMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values(message).returning();
    return result[0];
  }

  async getMessage(messageId: number): Promise<ChatMessage | undefined> {
    const result = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
    return result[0];
  }

  async pinMessage(messageId: number, isPinned: boolean): Promise<ChatMessage> {
    const result = await db.update(chatMessages)
      .set({ isPinned })
      .where(eq(chatMessages.id, messageId))
      .returning();
    return result[0];
  }

  async deleteMessage(messageId: number): Promise<boolean> {
    const result = await db.delete(chatMessages).where(eq(chatMessages.id, messageId)).returning();
    return result.length > 0;
  }

  // DM Conversation methods
  async getConversations(userId: string, appSpaceId: number): Promise<Array<{
    id: number;
    appSpaceId: number;
    createdAt: Date;
    participants: Array<{ id: string; username: string | null; displayName: string | null; avatarUrl: string | null }>;
    lastMessage?: { content: string; createdAt: Date; senderId: string };
  }>> {
    // Get all conversation IDs where user is a participant
    const userConversations = await db.select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
      .where(and(
        eq(conversationParticipants.userId, userId),
        eq(conversations.appSpaceId, appSpaceId)
      ));

    if (userConversations.length === 0) return [];

    const conversationIds = userConversations.map(c => c.conversationId);

    // Get conversation details with participants
    const result: Array<{
      id: number;
      appSpaceId: number;
      createdAt: Date;
      participants: Array<{ id: string; username: string | null; displayName: string | null; avatarUrl: string | null }>;
      lastMessage?: { content: string; createdAt: Date; senderId: string };
    }> = [];

    for (const convId of conversationIds) {
      const conv = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
      if (!conv[0]) continue;

      // Get participants
      const participants = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
        .from(conversationParticipants)
        .innerJoin(users, eq(conversationParticipants.userId, users.id))
        .where(eq(conversationParticipants.conversationId, convId));

      // Get last message
      const lastMessage = await db.select({
        content: directMessages.content,
        createdAt: directMessages.createdAt,
        senderId: directMessages.senderId,
      })
        .from(directMessages)
        .where(eq(directMessages.conversationId, convId))
        .orderBy(desc(directMessages.createdAt))
        .limit(1);

      result.push({
        id: conv[0].id,
        appSpaceId: conv[0].appSpaceId,
        createdAt: conv[0].createdAt,
        participants,
        lastMessage: lastMessage[0],
      });
    }

    // Sort by last message date
    return result.sort((a, b) => {
      const aDate = a.lastMessage?.createdAt || a.createdAt;
      const bDate = b.lastMessage?.createdAt || b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });
  }

  async getConversation(conversationId: number): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    return result[0];
  }

  async getConversationParticipants(conversationId: number): Promise<Array<{ id: string; username: string | null; displayName: string | null; avatarUrl: string | null }>> {
    return db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
      .from(conversationParticipants)
      .innerJoin(users, eq(conversationParticipants.userId, users.id))
      .where(eq(conversationParticipants.conversationId, conversationId));
  }

  async isConversationParticipant(conversationId: number, userId: string): Promise<boolean> {
    const result = await db.select()
      .from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ))
      .limit(1);
    return result.length > 0;
  }

  async createConversation(participantIds: string[], appSpaceId: number): Promise<Conversation> {
    // Create conversation
    const [conversation] = await db.insert(conversations).values({ appSpaceId }).returning();

    // Add participants
    const participantValues = participantIds.map(userId => ({
      conversationId: conversation.id,
      userId,
    }));
    await db.insert(conversationParticipants).values(participantValues);

    return conversation;
  }

  async findExistingConversation(participantIds: string[], appSpaceId: number): Promise<Conversation | undefined> {
    // Find conversations in this app space that have exactly these participants
    const convs = await db.select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.appSpaceId, appSpaceId));

    for (const conv of convs) {
      const participants = await db.select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, conv.id));

      const convUserIds = participants.map(p => p.userId).sort();
      const targetIds = [...participantIds].sort();

      if (convUserIds.length === targetIds.length && convUserIds.every((id, i) => id === targetIds[i])) {
        const result = await db.select().from(conversations).where(eq(conversations.id, conv.id)).limit(1);
        return result[0];
      }
    }
    return undefined;
  }

  async getOrCreateConversation(participantIds: string[], appSpaceId: number): Promise<Conversation> {
    // Check if conversation already exists
    const existing = await this.findExistingConversation(participantIds, appSpaceId);
    if (existing) return existing;

    // Create new conversation
    return this.createConversation(participantIds, appSpaceId);
  }

  async getDirectMessages(conversationId: number, limit: number = 50, before?: number): Promise<Array<DirectMessage & { user: { id: string; username: string | null; displayName: string | null; avatarUrl: string | null } }>> {
    const result = await db.select({
      id: directMessages.id,
      conversationId: directMessages.conversationId,
      senderId: directMessages.senderId,
      content: directMessages.content,
      createdAt: directMessages.createdAt,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      }
    })
      .from(directMessages)
      .innerJoin(users, eq(directMessages.senderId, users.id))
      .where(before
        ? and(eq(directMessages.conversationId, conversationId), lt(directMessages.id, before))
        : eq(directMessages.conversationId, conversationId)
      )
      .orderBy(desc(directMessages.createdAt))
      .limit(limit);

    return result.reverse(); // Return oldest first
  }

  async sendDirectMessage(conversationId: number, senderId: string, content: string): Promise<DirectMessage> {
    const [message] = await db.insert(directMessages).values({
      conversationId,
      senderId,
      content,
    }).returning();
    return message;
  }

  async getOrCreateFounderConversation(userId: string, appSpaceId: number): Promise<Conversation & { founderId: string }> {
    // Get the founder of this app space
    const appSpace = await this.getAppSpace(appSpaceId);
    if (!appSpace) throw new Error("App space not found");

    const founderId = appSpace.founderId;
    if (userId === founderId) throw new Error("Cannot create conversation with yourself");

    const conversation = await this.getOrCreateConversation([userId, founderId], appSpaceId);
    return { ...conversation, founderId };
  }

  // ============ USER CHANNEL READ METHODS ============

  async getChannelLastRead(userId: string, channelId: number): Promise<Date | null> {
    const result = await db.select()
      .from(userChannelRead)
      .where(and(
        eq(userChannelRead.userId, userId),
        eq(userChannelRead.channelId, channelId)
      ))
      .limit(1);
    return result[0]?.lastReadAt || null;
  }

  async markChannelRead(userId: string, channelId: number): Promise<void> {
    const existing = await db.select()
      .from(userChannelRead)
      .where(and(
        eq(userChannelRead.userId, userId),
        eq(userChannelRead.channelId, channelId)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(userChannelRead)
        .set({ lastReadAt: new Date() })
        .where(and(
          eq(userChannelRead.userId, userId),
          eq(userChannelRead.channelId, channelId)
        ));
    } else {
      await db.insert(userChannelRead).values({
        userId,
        channelId,
        lastReadAt: new Date(),
      });
    }
  }

  async getUnreadCountsForUser(userId: string, appSpaceId: number): Promise<Record<number, number>> {
    // Get all channels for this app space
    const channelsList = await this.getChannels(appSpaceId);
    const result: Record<number, number> = {};

    for (const channel of channelsList) {
      const lastRead = await this.getChannelLastRead(userId, channel.id);

      // Count messages newer than last read time (or all messages if never read)
      const countResult = await db.select({ count: count() })
        .from(chatMessages)
        .where(
          lastRead
            ? and(eq(chatMessages.channelId, channel.id), gt(chatMessages.createdAt, lastRead))
            : eq(chatMessages.channelId, channel.id)
        );

      result[channel.id] = countResult[0]?.count || 0;
    }

    return result;
  }

  // ============ NOTIFICATIONS METHODS ============

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    return db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: count() })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      ));
    return result[0]?.count || 0;
  }

  async markNotificationRead(notificationId: number, userId: string): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
  }

  // ============ MESSAGE REACTIONS METHODS ============

  async addReaction(messageId: number, userId: string, emoji: string): Promise<MessageReaction> {
    // Check if reaction already exists
    const existing = await db.select()
      .from(messageReactions)
      .where(and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, emoji)
      ))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const result = await db.insert(messageReactions).values({
      messageId,
      userId,
      emoji,
    }).returning();
    return result[0];
  }

  async removeReaction(messageId: number, userId: string, emoji: string): Promise<boolean> {
    const result = await db.delete(messageReactions)
      .where(and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, emoji)
      ))
      .returning();
    return result.length > 0;
  }

  async getMessageReactions(messageId: number): Promise<Array<{ emoji: string; count: number; users: string[] }>> {
    const reactions = await db.select()
      .from(messageReactions)
      .where(eq(messageReactions.messageId, messageId));

    // Group by emoji
    const grouped: Record<string, string[]> = {};
    for (const reaction of reactions) {
      if (!grouped[reaction.emoji]) {
        grouped[reaction.emoji] = [];
      }
      grouped[reaction.emoji].push(reaction.userId);
    }

    return Object.entries(grouped).map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      users: userIds,
    }));
  }

  async getMessagesWithReactions(channelId: number, limit: number = 50, before?: number): Promise<Array<ChatMessage & { user: any; reactions: Array<{ emoji: string; count: number; users: string[] }> }>> {
    const messages = await this.getMessages(channelId, limit, before);

    const messagesWithReactions = await Promise.all(
      messages.map(async (msg) => ({
        ...msg,
        reactions: await this.getMessageReactions(msg.id),
      }))
    );

    return messagesWithReactions;
  }

  // ============ APP SPACE DRAFT METHODS ============

  async saveDraft(userId: string, data: string): Promise<AppSpaceDraft> {
    const existing = await db.select()
      .from(appSpaceDrafts)
      .where(eq(appSpaceDrafts.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const result = await db.update(appSpaceDrafts)
        .set({ data, updatedAt: new Date() })
        .where(eq(appSpaceDrafts.userId, userId))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(appSpaceDrafts).values({
        userId,
        data,
      }).returning();
      return result[0];
    }
  }

  async getDraft(userId: string): Promise<AppSpaceDraft | undefined> {
    const result = await db.select()
      .from(appSpaceDrafts)
      .where(eq(appSpaceDrafts.userId, userId))
      .limit(1);
    return result[0];
  }

  async deleteDraft(userId: string): Promise<boolean> {
    const result = await db.delete(appSpaceDrafts)
      .where(eq(appSpaceDrafts.userId, userId))
      .returning();
    return result.length > 0;
  }

  // ============ ADMIN IDEAS METHODS ============

  async createAdminIdea(idea: InsertAdminIdea): Promise<AdminIdea> {
    const result = await db.insert(adminIdeas).values(idea).returning();
    return result[0];
  }

  async getAdminIdeas(): Promise<AdminIdea[]> {
    return db.select()
      .from(adminIdeas)
      .orderBy(desc(adminIdeas.createdAt));
  }

  async updateAdminIdea(id: number, updates: Partial<InsertAdminIdea>): Promise<AdminIdea> {
    const result = await db.update(adminIdeas)
      .set(updates)
      .where(eq(adminIdeas.id, id))
      .returning();
    return result[0];
  }

  async deleteAdminIdea(id: number): Promise<boolean> {
    const result = await db.delete(adminIdeas)
      .where(eq(adminIdeas.id, id))
      .returning();
    return result.length > 0;
  }

  // ============ MESSAGE SEARCH METHODS ============

  async searchMessages(userId: string, appSpaceId: number, query: string, limit: number = 50): Promise<Array<ChatMessage & { user: any; channelName: string }>> {
    // Get channels the user has access to
    const member = await this.getWaitlistMember(appSpaceId, userId);
    const appSpace = await this.getAppSpace(appSpaceId);
    const user = await this.getUser(userId);
    const isFounder = appSpace?.founderId === userId || user?.hasFounderAccess;

    // Get accessible channels
    const allChannels = await this.getChannels(appSpaceId);
    const accessibleChannels = allChannels.filter(channel => {
      if (isFounder) return true;
      if (channel.isLocked && member?.status !== "approved") return false;
      if (channel.isWaitlistersOnly && !member) return false;
      return true;
    });

    if (accessibleChannels.length === 0) return [];

    const channelIds = accessibleChannels.map(c => c.id);
    const channelNameMap = Object.fromEntries(accessibleChannels.map(c => [c.id, c.name]));

    const result = await db.select({
      id: chatMessages.id,
      channelId: chatMessages.channelId,
      userId: chatMessages.userId,
      content: chatMessages.content,
      isPinned: chatMessages.isPinned,
      createdAt: chatMessages.createdAt,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      }
    })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.userId, users.id))
      .where(and(
        inArray(chatMessages.channelId, channelIds),
        sql`${chatMessages.content} ILIKE ${'%' + query + '%'}`
      ))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    return result.map(msg => ({
      ...msg,
      channelName: channelNameMap[msg.channelId] || "unknown",
    }));
  }
  // ============ AUTH VERIFICATION & RISK METHODS ============

  async createAuthVerification(input: {
    userId: string;
    method: "phone" | "email";
    target: string;
    codeHash: string;
    ipAddress?: string | null;
    expiresAt: Date;
    maxAttempts?: number;
  }): Promise<AuthVerification> {
    await db.update(authVerifications)
      .set({ consumedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(authVerifications.userId, input.userId),
        eq(authVerifications.method, input.method),
        eq(authVerifications.target, input.target),
        sql`${authVerifications.consumedAt} IS NULL`
      ));

    const result = await db.insert(authVerifications).values({
      userId: input.userId,
      method: input.method,
      target: input.target,
      codeHash: input.codeHash,
      ipAddress: input.ipAddress ?? null,
      expiresAt: input.expiresAt,
      maxAttempts: input.maxAttempts ?? 5,
    }).returning();
    return result[0];
  }

  async getActiveAuthVerification(userId: string, method: "phone" | "email"): Promise<AuthVerification | undefined> {
    const result = await db.select().from(authVerifications)
      .where(and(
        eq(authVerifications.userId, userId),
        eq(authVerifications.method, method),
        sql`${authVerifications.consumedAt} IS NULL`
      ))
      .orderBy(desc(authVerifications.createdAt))
      .limit(1);
    return result[0];
  }

  async incrementAuthVerificationAttempt(id: number, lockUntil?: Date): Promise<AuthVerification | undefined> {
    const current = await db.select().from(authVerifications).where(eq(authVerifications.id, id)).limit(1);
    if (!current[0]) return undefined;

    const nextAttempts = (current[0].attempts ?? 0) + 1;
    const result = await db.update(authVerifications)
      .set({
        attempts: nextAttempts,
        lockedUntil: lockUntil ?? current[0].lockedUntil ?? null,
        updatedAt: new Date(),
      })
      .where(eq(authVerifications.id, id))
      .returning();
    return result[0];
  }

  async consumeAuthVerification(id: number): Promise<void> {
    await db.update(authVerifications)
      .set({ consumedAt: new Date(), updatedAt: new Date() })
      .where(eq(authVerifications.id, id));
  }

  async countRecentAuthVerificationsByIp(ipAddress: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const result = await db.select({ count: count() })
      .from(authVerifications)
      .where(and(
        eq(authVerifications.ipAddress, ipAddress),
        gte(authVerifications.createdAt, since)
      ));
    return result[0]?.count ?? 0;
  }

  async countRecentAuthVerificationsByTarget(target: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const result = await db.select({ count: count() })
      .from(authVerifications)
      .where(and(
        eq(authVerifications.target, target),
        gte(authVerifications.createdAt, since)
      ));
    return result[0]?.count ?? 0;
  }

  async createAuthRiskEvent(input: {
    userId?: string | null;
    method: "phone" | "email";
    target?: string | null;
    eventType: string;
    severity?: "low" | "medium" | "high" | "critical";
    ipAddress?: string | null;
    metadata?: string | null;
  }): Promise<AuthRiskEvent> {
    const result = await db.insert(authRiskEvents).values({
      userId: input.userId ?? null,
      method: input.method,
      target: input.target ?? null,
      eventType: input.eventType,
      severity: input.severity ?? "medium",
      ipAddress: input.ipAddress ?? null,
      metadata: input.metadata ?? null,
    }).returning();
    return result[0];
  }

  // ============ GOLDEN TICKET METHODS ============

  async getOrCreateGoldenTicket(appSpaceId: number): Promise<GoldenTicket> {
    const existing = await db.select().from(goldenTickets)
      .where(eq(goldenTickets.appSpaceId, appSpaceId))
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    const created = await db.insert(goldenTickets).values({
      appSpaceId,
      status: "open",
      serviceContingent: true,
      nonTransferable: true,
      rateLimitedByPolicy: true,
      winnerVisibility: "status_only",
    }).returning();

    const defaultTiers = [
      { rank: 1, label: "1st", reward: "Max tier access free for life", isLifetime: true },
      { rank: 2, label: "10^1", reward: "1 year free access", isLifetime: false },
      { rank: 3, label: "10^2", reward: "6 months free access", isLifetime: false },
    ];

    await db.insert(ticketTiers).values(defaultTiers.map((tier) => ({
      goldenTicketId: created[0].id,
      rank: tier.rank,
      label: tier.label,
      reward: tier.reward,
      isLifetime: tier.isLifetime,
      benefits: JSON.stringify([tier.reward]),
    })));

    return created[0];
  }

  async getGoldenTicketByAppSpaceId(appSpaceId: number): Promise<GoldenTicket | undefined> {
    const result = await db.select().from(goldenTickets)
      .where(eq(goldenTickets.appSpaceId, appSpaceId))
      .limit(1);
    return result[0];
  }

  async getTicketTiers(goldenTicketId: number): Promise<TicketTier[]> {
    return db.select().from(ticketTiers)
      .where(eq(ticketTiers.goldenTicketId, goldenTicketId))
      .orderBy(asc(ticketTiers.rank));
  }

  async replaceTicketTiers(goldenTicketId: number, tiers: Array<{ rank: number; label: string; reward: string; isLifetime: boolean; benefits?: string[] }>): Promise<TicketTier[]> {
    await db.delete(ticketTiers).where(eq(ticketTiers.goldenTicketId, goldenTicketId));
    if (tiers.length === 0) return [];

    const inserted = await db.insert(ticketTiers).values(
      tiers.map((tier) => ({
        goldenTicketId,
        rank: tier.rank,
        label: tier.label,
        reward: tier.reward,
        isLifetime: tier.isLifetime,
        benefits: JSON.stringify(tier.benefits ?? [tier.reward]),
      }))
    ).returning();

    return inserted.sort((a, b) => a.rank - b.rank);
  }

  async updateGoldenTicketPolicy(appSpaceId: number, updates: Partial<Pick<GoldenTicket, "serviceContingent" | "nonTransferable" | "rateLimitedByPolicy" | "winnerVisibility">>): Promise<GoldenTicket> {
    const existing = await this.getOrCreateGoldenTicket(appSpaceId);
    const result = await db.update(goldenTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(goldenTickets.id, existing.id))
      .returning();
    return result[0];
  }

  async selectGoldenTicketWinner(appSpaceId: number, winnerUserId: string, selectedByUserId: string, reason?: string): Promise<GoldenTicket> {
    const existing = await this.getOrCreateGoldenTicket(appSpaceId);
    const result = await db.update(goldenTickets)
      .set({
        status: "selected",
        winnerUserId,
        selectedByUserId,
        selectedAt: new Date(),
        selectionReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(goldenTickets.id, existing.id))
      .returning();
    return result[0];
  }

  async createTicketAuditEvent(input: {
    appSpaceId: number;
    goldenTicketId: number;
    actorUserId?: string | null;
    eventType: string;
    eventData?: string | null;
  }): Promise<TicketAuditEvent> {
    const result = await db.insert(ticketAuditEvents).values({
      appSpaceId: input.appSpaceId,
      goldenTicketId: input.goldenTicketId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      eventData: input.eventData ?? null,
    }).returning();
    return result[0];
  }

  async getTicketAuditEvents(appSpaceId: number): Promise<TicketAuditEvent[]> {
    return db.select().from(ticketAuditEvents)
      .where(eq(ticketAuditEvents.appSpaceId, appSpaceId))
      .orderBy(desc(ticketAuditEvents.createdAt));
  }

  async createTicketPolicyEvent(input: InsertTicketPolicyEvent): Promise<TicketPolicyEvent> {
    const result = await db.insert(ticketPolicyEvents).values(input).returning();
    return result[0];
  }

  async getTicketPolicyEvents(appSpaceId: number): Promise<TicketPolicyEvent[]> {
    return db.select().from(ticketPolicyEvents)
      .where(eq(ticketPolicyEvents.appSpaceId, appSpaceId))
      .orderBy(desc(ticketPolicyEvents.createdAt));
  }

  async getTicketPolicyEventById(id: number): Promise<TicketPolicyEvent | undefined> {
    const result = await db.select().from(ticketPolicyEvents)
      .where(eq(ticketPolicyEvents.id, id))
      .limit(1);
    return result[0];
  }

  async updateTicketPolicyEvent(id: number, updates: Partial<Pick<TicketPolicyEvent, "status" | "resolution" | "resolvedByUserId" | "resolvedAt">>): Promise<TicketPolicyEvent> {
    const result = await db.update(ticketPolicyEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(ticketPolicyEvents.id, id))
      .returning();
    return result[0];
  }

  async getGoldenTicketPublicSummary(appSpaceId: number, currentUserId?: string): Promise<{
    status: "open" | "selected" | "closed";
    selected: boolean;
    selectedAt: Date | null;
    isWinner: boolean;
    serviceContingent: boolean;
  }> {
    const ticket = await this.getOrCreateGoldenTicket(appSpaceId);
    return {
      status: (ticket.status as "open" | "selected" | "closed") ?? "open",
      selected: ticket.status === "selected",
      selectedAt: ticket.selectedAt ?? null,
      isWinner: !!currentUserId && ticket.winnerUserId === currentUserId,
      serviceContingent: !!ticket.serviceContingent,
    };
  }

  // ============ ACCOUNT DELETION ============

  async deleteUserAccount(userId: string): Promise<void> {
    const ownedAppSpaces = await db.select({ id: appSpaces.id })
      .from(appSpaces)
      .where(eq(appSpaces.founderId, userId));

    // Delete owned app spaces and dependent entities in safe order.
    for (const space of ownedAppSpaces) {
      await db.execute(sql`DELETE FROM ticket_audit_events WHERE app_space_id = ${space.id}`);
      await db.execute(sql`DELETE FROM ticket_policy_events WHERE app_space_id = ${space.id}`);
      await db.execute(sql`DELETE FROM ticket_tiers WHERE golden_ticket_id IN (SELECT id FROM golden_tickets WHERE app_space_id = ${space.id})`);
      await db.execute(sql`DELETE FROM golden_tickets WHERE app_space_id = ${space.id}`);

      await db.execute(sql`DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM chat_messages WHERE channel_id IN (SELECT id FROM channels WHERE app_space_id = ${space.id}))`);
      await db.execute(sql`DELETE FROM user_channel_read WHERE channel_id IN (SELECT id FROM channels WHERE app_space_id = ${space.id})`);
      await db.execute(sql`DELETE FROM chat_messages WHERE channel_id IN (SELECT id FROM channels WHERE app_space_id = ${space.id})`);
      await db.execute(sql`DELETE FROM channels WHERE app_space_id = ${space.id}`);

      await db.execute(sql`DELETE FROM direct_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE app_space_id = ${space.id})`);
      await db.execute(sql`DELETE FROM conversation_participants WHERE conversation_id IN (SELECT id FROM conversations WHERE app_space_id = ${space.id})`);
      await db.execute(sql`DELETE FROM conversations WHERE app_space_id = ${space.id}`);

      await db.execute(sql`DELETE FROM poll_votes WHERE poll_id IN (SELECT id FROM polls WHERE app_space_id = ${space.id})`);
      await db.execute(sql`DELETE FROM polls WHERE app_space_id = ${space.id}`);
      await db.execute(sql`DELETE FROM announcements WHERE app_space_id = ${space.id}`);

      await db.execute(sql`DELETE FROM badge_awards WHERE custom_badge_id IN (SELECT id FROM custom_badges WHERE app_space_id = ${space.id})`);
      await db.execute(sql`DELETE FROM custom_badges WHERE app_space_id = ${space.id}`);

      await db.execute(sql`DELETE FROM survey_responses WHERE app_space_id = ${space.id}`);
      await db.execute(sql`DELETE FROM survey_questions WHERE app_space_id = ${space.id}`);
      await db.execute(sql`DELETE FROM waitlist_members WHERE app_space_id = ${space.id}`);

      await db.execute(sql`DELETE FROM app_spaces WHERE id = ${space.id}`);
    }

    await db.delete(ticketPolicyEvents).where(eq(ticketPolicyEvents.reporterUserId, userId));
    await db.delete(ticketAuditEvents).where(eq(ticketAuditEvents.actorUserId, userId));
    await db.delete(authRiskEvents).where(eq(authRiskEvents.userId, userId));
    await db.delete(authVerifications).where(eq(authVerifications.userId, userId));

    await db.delete(notifications).where(eq(notifications.userId, userId));
    await db.delete(userChannelRead).where(eq(userChannelRead.userId, userId));
    await db.delete(messageReactions).where(eq(messageReactions.userId, userId));
    await db.delete(directMessages).where(eq(directMessages.senderId, userId));
    await db.delete(conversationParticipants).where(eq(conversationParticipants.userId, userId));
    await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
    await db.delete(pollVotes).where(eq(pollVotes.userId, userId));
    await db.delete(surveyResponses).where(eq(surveyResponses.userId, userId));
    await db.delete(waitlistMembers).where(eq(waitlistMembers.userId, userId));

    await db.delete(badgeAwards).where(or(eq(badgeAwards.userId, userId), eq(badgeAwards.awardedBy, userId)));
    await db.delete(userSettings).where(eq(userSettings.userId, userId));
    await db.delete(appSpaceDrafts).where(eq(appSpaceDrafts.userId, userId));

    await db.delete(users).where(eq(users.id, userId));
  }

}

export const storage = new DbStorage();
