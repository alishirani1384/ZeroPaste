import Constants from "expo-constants";

/**
 * Public web origin for Supabase email confirmation links.
 * Email always opens in a browser — never use a deep link as the only redirect.
 */
export function getPublicSiteUrl(): string {
  const fromProcess = process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromProcess) return fromProcess;
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const fromExtra = extra?.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromExtra) return fromExtra;
  return "https://zeropaste.vercel.app";
}

export function getAuthEmailRedirectTo(): string {
  return `${getPublicSiteUrl()}/auth/callback`;
}
