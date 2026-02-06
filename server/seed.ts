import { db } from "./db";
import {
  appSpaces,
  users,
  customBadges,
  badgeAwards,
  waitlistMembers,
  surveyQuestions,
  surveyResponses,
  announcements,
  polls,
  pollVotes,
  channels
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

// Database cleanup function - deletes all data in the correct order for foreign key constraints
export async function cleanupDatabase() {
  console.log("Starting database cleanup...");

  // Delete in correct order for foreign key constraints
  console.log("Deleting poll votes...");
  await db.delete(pollVotes);

  console.log("Deleting polls...");
  await db.delete(polls);

  console.log("Deleting badge awards...");
  await db.delete(badgeAwards);

  console.log("Deleting custom badges...");
  await db.delete(customBadges);

  console.log("Deleting survey responses...");
  await db.delete(surveyResponses);

  console.log("Deleting survey questions...");
  await db.delete(surveyQuestions);

  console.log("Deleting announcements...");
  await db.delete(announcements);

  console.log("Deleting waitlist members...");
  await db.delete(waitlistMembers);

  console.log("Deleting app spaces...");
  await db.delete(appSpaces);

  console.log("Deleting users...");
  await db.delete(users);

  console.log("Database cleanup complete! All data has been deleted.");
}

const defaultBadges = [
  { name: "MVP", description: "Most Valuable Player - Exceptional contribution", icon: "🏆" },
  { name: "Bug Hunter", description: "Found and reported bugs", icon: "🐛" },
  { name: "Top Contributor", description: "Exceptional community member", icon: "⭐" },
  { name: "Early Bird", description: "Among the first to join", icon: "🐦" },
];

async function seedFirstUserAppSpace() {
  console.log("Checking for FirstUser AppSpace...");
  
  const superAdminUsers = await db.select().from(users).where(sql`${users.phone} LIKE '%3477444249'`).limit(1);
  
  let founderId: string;
  
  if (superAdminUsers.length > 0) {
    founderId = superAdminUsers[0].id;
    console.log("Found super-admin user, using as founder.");
  } else {
    console.log("Super-admin not found, creating system user as placeholder founder.");
    const hashedPassword = await bcrypt.hash("system-placeholder-" + Date.now(), 10);
    const systemUserResult = await db.insert(users).values({
      email: "system@firstuser.app",
      password: hashedPassword,
      hasFounderAccess: true,
    }).returning();
    founderId = systemUserResult[0].id;
    console.log("Created system user with ID:", founderId);
  }
  
  const firstUserData = {
    name: "FirstUser",
    slug: "firstuser",
    tagline: "Turn your waitlist into a thriving community before you even launch",
    description: "The platform for early adopter communities. Join our waitlist to create your own.",
    icon: "🚀",
    category: "Community Tools",
    
    problemTitle: "Waitlists are dead ends",
    problemDescription: "You collect emails, send a launch announcement, and hope people remember why they signed up. Most don't. Your waitlist becomes a graveyard of forgotten signups.",
    
    solutionTitle: "A community that grows while you build",
    solutionDescription: "FirstUser transforms passive signups into active community members. Early adopters earn status, connect with each other, and become invested in your success.",
    solutionPoints: JSON.stringify([
      "Turn signups into engaged community members",
      "Reward early adopters with exclusive perks",
      "Build social proof before you launch"
    ]),
    
    founders: JSON.stringify([
      { name: "Founder", title: "Creator", avatar: "F" }
    ]),
    
    tierRewards: JSON.stringify([
      { tier: "1st", label: "First User", reward: "Lifetime free + founding member badge" },
      { tier: "10¹", label: "First 10", reward: "1 year free + early access" },
      { tier: "10²", label: "First 100", reward: "6 months free + beta access" },
      { tier: "10³", label: "First 1,000", reward: "3 months free" },
      { tier: "10⁴", label: "First 10,000", reward: "1 month free" }
    ]),
    
    founderId: founderId,
  };
  
  const existing = await db.select().from(appSpaces).where(eq(appSpaces.slug, "firstuser")).limit(1);
  
  if (existing.length > 0) {
    await db.update(appSpaces)
      .set({
        tagline: firstUserData.tagline,
        icon: firstUserData.icon,
        category: firstUserData.category,
        problemTitle: firstUserData.problemTitle,
        problemDescription: firstUserData.problemDescription,
        solutionTitle: firstUserData.solutionTitle,
        solutionDescription: firstUserData.solutionDescription,
        solutionPoints: firstUserData.solutionPoints,
        founders: firstUserData.founders,
        tierRewards: firstUserData.tierRewards,
      })
      .where(eq(appSpaces.slug, "firstuser"));
    console.log("Updated FirstUser AppSpace with new fields.");
    return;
  }
  
  const appSpaceResult = await db.insert(appSpaces).values(firstUserData).returning();
  
  console.log("FirstUser AppSpace created successfully!");
  
  const appSpaceId = appSpaceResult[0].id;
  for (const badge of defaultBadges) {
    await db.insert(customBadges).values({
      appSpaceId,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
    });
  }
  console.log(`Seeded ${defaultBadges.length} default badges for FirstUser`);
  
  // Create default channels
  const defaultChannels = [
    { name: "general", description: "General discussion for the community", type: "chat" as const },
    { name: "introductions", description: "Introduce yourself to the community", type: "chat" as const },
    { name: "feedback", description: "Share your feedback and suggestions", type: "chat" as const },
    { name: "announcements", description: "Official announcements from the founders", type: "chat" as const },
  ];
  
  for (const channel of defaultChannels) {
    await db.insert(channels).values({
      appSpaceId,
      name: channel.name,
      description: channel.description,
      type: channel.type,
    });
  }
  console.log(`Seeded ${defaultChannels.length} default channels for FirstUser`);
}

async function seedExistingAppSpaceBadges() {
  const spaces = await db.select().from(appSpaces);
  for (const space of spaces) {
    const existing = await db.select().from(customBadges).where(eq(customBadges.appSpaceId, space.id));
    if (existing.length === 0) {
      for (const badge of defaultBadges) {
        await db.insert(customBadges).values({
          appSpaceId: space.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
        });
      }
      console.log(`Seeded ${defaultBadges.length} default badges for AppSpace ${space.slug}`);
    }
  }
}

// Check for command line arguments
const args = process.argv.slice(2);

if (args.includes("--cleanup")) {
  // Run cleanup only
  cleanupDatabase()
    .then(() => {
      console.log("Cleanup complete.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Cleanup failed:", error);
      process.exit(1);
    });
} else {
  // Run normal seed process
  seedFirstUserAppSpace()
    .then(() => seedExistingAppSpaceBadges())
    .then(() => {
      console.log("Seed complete.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}
