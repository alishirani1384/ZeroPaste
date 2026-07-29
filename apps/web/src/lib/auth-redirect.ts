/**
 * Public origin used in Supabase email links (confirm signup, reset password).
 * Must be an https URL listed under Supabase Auth → Redirect URLs.
 * Do not use window.location.origin on desktop (views:// / localhost).
 */
export function getPublicSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "https://zeropaste.vercel.app";
}

/** Where Supabase should send the user after they click the email link. */
export function getAuthEmailRedirectTo(): string {
  return `${getPublicSiteUrl()}/auth/callback`;
}
