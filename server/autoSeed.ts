import { db } from "./db";
import { appSpaces, users, customBadges, channels } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const defaultBadges = [
  { name: "MVP", description: "Most Valuable Player - Exceptional contribution", icon: "🏆" },
  { name: "Bug Hunter", description: "Found and reported bugs", icon: "🐛" },
  { name: "Top Contributor", description: "Exceptional community member", icon: "⭐" },
  { name: "Early Bird", description: "Among the first to join", icon: "🐦" },
];

export async function autoSeedIfNeeded() {
  try {
    const existing = await db.select().from(appSpaces).where(eq(appSpaces.slug, "firstuser")).limit(1);
    
    if (existing.length > 0) {
      console.log("[AutoSeed] FirstUser AppSpace already exists, skipping seed.");
      return;
    }
    
    console.log("[AutoSeed] FirstUser AppSpace not found, creating...");
    
    const hashedPassword = await bcrypt.hash("system-placeholder-" + Date.now(), 10);
    const systemUserResult = await db.insert(users).values({
      id: "system",
      email: "system@firstuser.app",
      password: hashedPassword,
      firstName: "FirstUser",
      lastName: "System",
      hasFounderAccess: true,
    }).onConflictDoNothing().returning();
    
    let founderId = "system";
    if (systemUserResult.length > 0) {
      founderId = systemUserResult[0].id;
      console.log("[AutoSeed] Created system user.");
    } else {
      console.log("[AutoSeed] System user already exists.");
    }
    
    const firstUserData = {
      name: "FirstUser",
      slug: "firstuser",
      tagline: "Your waitlist is already obsessed with your new startup. Give them somewhere to prove it.",
      description: "The platform for early adopter communities. Build your waitlist and engage your first users before you launch.",
      icon: "🚀",
      category: "Community Tools",
      
      problemTitle: "Waitlists are dead ends. You know nothing about your early users.",
      problemDescription: "You collect emails, maybe send an update, and hope they remember you when you launch. Most won't. The ones who would've fought for you? Buried in a CSV, indistinguishable from everyone else.",
      
      solutionTitle: "Turn believers into founders-in-waiting",
      solutionDescription: "Your waitlist becomes a live community. Early supporters chat, give feedback, and prove they care. When you let them in, they've already earned lifetime access, discounts, or founding member status. The people who helped you build get treated like it.",
      solutionPoints: JSON.stringify([
        "Turn signups into engaged believers",
        "Reward early adopters automatically",
        "Launch to a community, not a cold list"
      ]),
      
      founders: JSON.stringify([
        { name: "Chris Carmichael", title: "Founder", photoUrl: "/uploads/chris-carmichael.jpeg", linkedInUrl: "https://www.linkedin.com/in/christophercarm/" }
      ]),
      
      tierRewards: JSON.stringify([
        { tier: "1st", label: "First User", reward: "Unlimited Lifetime access for free" },
        { tier: "10¹", label: "First 10 users", reward: "1 year free + early access" },
        { tier: "10²", label: "First 100 users", reward: "6 months free + beta access" },
        { tier: "10³", label: "First 1,000 users", reward: "3 months free" },
        { tier: "10⁴", label: "First 10,000 users", reward: "1 month free" }
      ]),
      
      logoUrl: "/uploads/firstuser-logo.png",
      founderId: founderId,
    };
    
    const appSpaceResult = await db.insert(appSpaces).values(firstUserData).returning();
    console.log("[AutoSeed] FirstUser AppSpace created!");
    
    const appSpaceId = appSpaceResult[0].id;
    
    for (const badge of defaultBadges) {
      await db.insert(customBadges).values({
        appSpaceId,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
      }).onConflictDoNothing();
    }
    console.log(`[AutoSeed] Seeded ${defaultBadges.length} default badges.`);
    
    const defaultChannels = [
      {
        name: "forum-waitlist",
        description: "Forum posts for waitlist members",
        type: "forum" as const,
        isLocked: false,
        isWaitlistersOnly: true,
      },
      { name: "general", description: "General discussion for the community", type: "chat" as const, isLocked: true },
      { name: "introductions", description: "Introduce yourself to the community", type: "chat" as const, isLocked: true },
      { name: "feedback", description: "Share your feedback and suggestions", type: "chat" as const, isLocked: true },
    ];
    
    for (const channel of defaultChannels) {
      await db.insert(channels).values({
        appSpaceId,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        isLocked: channel.isLocked,
        isWaitlistersOnly: channel.isWaitlistersOnly || false,
      }).onConflictDoNothing();
    }
    console.log(`[AutoSeed] Seeded ${defaultChannels.length} default channels.`);
    
    console.log("[AutoSeed] Complete!");
    
  } catch (error) {
    console.error("[AutoSeed] Error:", error);
  }
}
