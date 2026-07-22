import type { ConfigContext, ExpoConfig } from "expo/config";
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

// Ensure local/CI `.env` is visible when Expo evaluates this file (prebuild + Metro).
loadDotenv({ path: resolve(__dirname, ".env") });

/**
 * Dynamic config so CI / local `.env` values are embedded into `extra`
 * (read by `lib/supabase.ts`). Relies on EXPO_PUBLIC_* being present when
 * this file is evaluated (prebuild + Metro bundle).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "ZeroPaste",
  slug: "zeropaste",
  version: "1.0.5",
  orientation: "portrait",
  scheme: "zeropaste",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "app.zeropaste.mobile",
    icon: "./assets/icon.png",
  },
  android: {
    package: "app.zeropaste.mobile",
    versionCode: 5,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1C1C1E",
    },
    permissions: [
      "android.permission.PACKAGE_USAGE_STATS",
      "android.permission.INTERNET",
      "android.permission.VIBRATE",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    ],
  },
  web: {
    bundler: "metro",
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-font",
    "expo-secure-store",
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#000000",
        image: "./assets/splash-icon.png",
        imageWidth: 180,
        resizeMode: "contain",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "d43a24b3-f6c4-4ec6-b34b-4d2c82cf0812",
    },
    // Baked into the binary so release APKs always see Supabase config.
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
    EXPO_PUBLIC_SERVER_URL: process.env.EXPO_PUBLIC_SERVER_URL ?? "",
  },
  owner: "alishiranis-team",
});
