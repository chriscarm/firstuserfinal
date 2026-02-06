const DEFAULT_HOMEPAGE_SLUG = "firstuser";

export function getHomepageAppSpaceSlug(): string {
  const rawValue = import.meta.env.VITE_HOMEPAGE_SPACE_SLUG;
  if (typeof rawValue !== "string") {
    return DEFAULT_HOMEPAGE_SLUG;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_HOMEPAGE_SLUG;
  }

  return normalized;
}

