import type { User, AppSpace, WaitlistMember } from "@shared/schema";

export async function register(email: string, password: string) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Registration failed");
  }
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Login failed");
  }
  return res.json();
}

export async function sendPhoneCode(phone: string, userId: string) {
  const res = await fetch("/api/auth/phone/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ phone, userId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to send code");
  }
  return res.json();
}

export async function verifyPhoneCode(phone: string, code: string, userId: string) {
  const res = await fetch("/api/auth/phone/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ phone, code, userId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Verification failed");
  }
  return res.json();
}

export async function checkUsernameAvailability(username: string) {
  const res = await fetch(`/api/auth/username/check?username=${encodeURIComponent(username)}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Failed to check username");
  }
  return res.json();
}

export async function claimUsername(username: string, userId: string) {
  const res = await fetch("/api/auth/username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, userId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to claim username");
  }
  return res.json();
}

export async function getCurrentUser(userId: string) {
  const res = await fetch("/api/auth/me", {
    headers: { "X-User-Id": userId },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Failed to get user");
  }
  return res.json();
}

export async function getAllAppSpaces(): Promise<AppSpace[]> {
  const res = await fetch("/api/appspaces");
  if (!res.ok) throw new Error("Failed to fetch app spaces");
  return res.json();
}

export async function getAppSpace(slug: string): Promise<AppSpace & { memberCount: number }> {
  const res = await fetch(`/api/appspaces/${slug}`);
  if (!res.ok) throw new Error("AppSpace not found");
  return res.json();
}

export async function createAppSpace(data: { slug: string; name: string; description: string; founderId: string }) {
  const res = await fetch("/api/appspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to create AppSpace");
  }
  return res.json();
}

export async function joinWaitlist(appSpaceId: number, userId: string): Promise<WaitlistMember> {
  const res = await fetch(`/api/appspaces/${appSpaceId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to join waitlist");
  }
  return res.json();
}

export async function getWaitlistMembers(appSpaceId: number): Promise<WaitlistMember[]> {
  const res = await fetch(`/api/appspaces/${appSpaceId}/waitlist`);
  if (!res.ok) throw new Error("Failed to fetch waitlist");
  return res.json();
}
