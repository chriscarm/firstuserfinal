const DEFAULT_HOMEPAGE_SLUG = "firstuser";

let warnedMissingHomepageOwnerPhone = false;

function normalizePhone(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

export function getHomepageSlug(): string {
  const rawValue = process.env.VITE_HOMEPAGE_SPACE_SLUG;
  if (typeof rawValue !== "string") {
    return DEFAULT_HOMEPAGE_SLUG;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_HOMEPAGE_SLUG;
  }

  return normalized;
}

export function getHomepageOwnerPhone(): string | null {
  const normalized = normalizePhone(process.env.HOMEPAGE_OWNER_PHONE);
  if (!normalized) {
    if (!warnedMissingHomepageOwnerPhone) {
      console.warn("[HomepageOwnership] HOMEPAGE_OWNER_PHONE is not configured. Homepage owner lock is disabled.");
      warnedMissingHomepageOwnerPhone = true;
    }
    return null;
  }

  return normalized;
}

export function isHomepageSlug(slug: string): boolean {
  return slug.trim().toLowerCase() === getHomepageSlug();
}

export function isHomepageOwnerUser(user: { phone?: string | null; phoneVerified?: boolean } | null | undefined): boolean {
  const ownerPhone = getHomepageOwnerPhone();
  if (!ownerPhone) {
    return false;
  }

  if (!user?.phoneVerified) {
    return false;
  }

  return normalizePhone(user.phone) === ownerPhone;
}
