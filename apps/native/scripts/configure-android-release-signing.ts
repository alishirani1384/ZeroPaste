/**
 * After `expo prebuild`, patch android/app/build.gradle so release builds
 * use a real upload keystore instead of the Expo/RN debug fallback.
 *
 * Expects:
 *   apps/native/android/app/zeropaste-release.keystore
 *   ANDROID_KEYSTORE_PASSWORD
 *   ANDROID_KEY_ALIAS
 *   ANDROID_KEY_PASSWORD
 *
 * Passwords are read from the environment at Gradle time (not written to disk).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const appDir = resolve(import.meta.dir, "../android/app");
const gradlePath = resolve(appDir, "build.gradle");
const storeFileName = "zeropaste-release.keystore";
const storePath = resolve(appDir, storeFileName);

const requiredEnv = [
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
] as const;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

for (const key of requiredEnv) {
  if (!process.env[key]?.trim()) {
    fail(`Missing required env var: ${key}`);
  }
}

if (!existsSync(storePath)) {
  fail(`Release keystore not found at ${storePath}`);
}

if (!existsSync(gradlePath)) {
  fail(`build.gradle not found at ${gradlePath} (run expo prebuild first)`);
}

let gradle = readFileSync(gradlePath, "utf8");

const alreadyPatched =
  gradle.includes(`storeFile file('${storeFileName}')`) &&
  gradle.includes("signingConfig signingConfigs.release");

if (alreadyPatched) {
  console.log("Release signing already configured — nothing to do");
  process.exit(0);
}

const releaseBlock = `        release {
            storeFile file('${storeFileName}')
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
`;

if (!gradle.includes("signingConfigs {")) {
  fail("Could not find signingConfigs { in build.gradle — Expo template may have changed");
}

gradle = gradle.replace(
  /(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s*\})/,
  `$1\n${releaseBlock}`,
);

if (!gradle.includes("storeFile file('zeropaste-release.keystore')")) {
  fail("Failed to inject release signingConfig into build.gradle");
}

const before = gradle;
gradle = gradle.replace(
  /\/\/ Caution! In production[\s\S]*?signingConfig signingConfigs\.debug/,
  "signingConfig signingConfigs.release",
);

if (gradle === before) {
  // Comment text may differ across Expo versions — fall back to the release block only.
  gradle = gradle.replace(
    /(release\s*\{\s*\n)(\s*)signingConfig signingConfigs\.debug/,
    "$1$2signingConfig signingConfigs.release",
  );
}

if (!gradle.includes("signingConfig signingConfigs.release")) {
  fail("Failed to point release buildType at signingConfigs.release");
}

writeFileSync(gradlePath, gradle);
console.log(`Configured release signing → ${storeFileName} (alias from ANDROID_KEY_ALIAS)`);
