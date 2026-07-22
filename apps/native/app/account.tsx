import { useCallback, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  hasUsageAccess,
  isClipboardWatchAvailable,
  isClipboardWatchEnabled,
  isClipboardWatchRunning,
  isIgnoringBatteryOptimizations,
  isSourceModuleAvailable,
  openUsageAccessSettings,
  requestIgnoreBatteryOptimizations,
  startClipboardWatch,
  stopClipboardWatch,
} from "zeropaste-source";

import { SettingsRow, SettingsSection } from "@/components/native-ui";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useAuth } from "@/contexts/auth-context";
import { useVault } from "@/contexts/vault-context";
import { colors } from "@/lib/theme";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, toggleTheme } = useAppTheme();
  const auth = useAuth();
  const vault = useVault();
  const ink = isDark ? colors.inkDark : colors.inkLight;
  const muted = isDark ? colors.mutedDark : colors.mutedLight;
  const bg = isDark ? colors.groupedDark : colors.groupedLight;

  const sourceAvailable = isSourceModuleAvailable();
  const watchAvailable = isClipboardWatchAvailable();
  const [usageOk, setUsageOk] = useState(false);
  const [watchOn, setWatchOn] = useState(false);
  const [watchRunning, setWatchRunning] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);

  const refreshWatch = useCallback(() => {
    if (Platform.OS === "android" && sourceAvailable) {
      setUsageOk(hasUsageAccess());
    }
    if (Platform.OS === "android" && watchAvailable) {
      setWatchOn(isClipboardWatchEnabled());
      setWatchRunning(isClipboardWatchRunning());
    }
  }, [sourceAvailable, watchAvailable]);

  useFocusEffect(
    useCallback(() => {
      refreshWatch();
    }, [refreshWatch]),
  );

  const toggleWatch = async (next: boolean) => {
    if (!watchAvailable || watchBusy || !vault.unlocked) return;
    setWatchBusy(true);
    try {
      if (next) {
        await startClipboardWatch();
        // Xiaomi / aggressive OEMs kill background apps unless exempted.
        if (!isIgnoringBatteryOptimizations()) {
          requestIgnoreBatteryOptimizations();
        }
      } else {
        await stopClipboardWatch({ disable: true });
      }
      refreshWatch();
    } finally {
      setWatchBusy(false);
    }
  };

  const statusLabel = auth.session
    ? (auth.session.user.email ?? "Signed in")
    : auth.offlineChosen
      ? "Offline"
      : "Signed out";

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.nav, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navSide}>
          <Text style={styles.navLink}>Done</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: ink }]}>Account</Text>
        <View style={styles.navSide} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection title="Profile">
          <SettingsRow label="Account" value={statusLabel} />
          <SettingsRow label="Vault" value={vault.unlocked ? "Unlocked" : "Locked"} />
          <SettingsRow
            label="Sync"
            value={auth.configured ? (auth.session ? "On" : "Sign in required") : "Not configured"}
            last
          />
        </SettingsSection>

        <SettingsSection title="Appearance">
          <SettingsRow
            label="Dark Mode"
            switchValue={isDark}
            onSwitch={() => toggleTheme()}
            last
          />
        </SettingsSection>

        {Platform.OS === "android" ? (
          <SettingsSection
            title="Clipboard"
            footer="Background watch uses a quiet notification so ZeroPaste can capture copies after you leave the app. Allow unrestricted battery if your phone asks — Xiaomi and similar OEMs otherwise kill the watch when you swipe ZeroPaste away. Usage Access helps label the source app."
          >
            <SettingsRow
              label="Background watch"
              switchValue={watchOn && watchRunning}
              onSwitch={(v) => void toggleWatch(v)}
              disabled={!watchAvailable || watchBusy || !vault.unlocked}
            />
            <SettingsRow
              label="Source apps"
              value={
                !sourceAvailable ? "Needs native build" : usageOk ? "Allowed" : "Off"
              }
              onPress={
                sourceAvailable && !usageOk ? () => openUsageAccessSettings() : undefined
              }
              showChevron={sourceAvailable && !usageOk}
              last
            />
          </SettingsSection>
        ) : null}

        <SettingsSection title="Security">
          {vault.unlocked ? (
            <SettingsRow
              label="Lock Vault"
              destructive
              onPress={async () => {
                await vault.lock();
                router.back();
              }}
              last={!auth.session}
            />
          ) : null}
          {auth.session ? (
            <SettingsRow
              label="Sign Out"
              destructive
              onPress={async () => {
                await auth.signOut();
                router.back();
              }}
              last
            />
          ) : vault.unlocked ? null : (
            <SettingsRow label="Signed out" value="—" last />
          )}
        </SettingsSection>

        {!watchAvailable && Platform.OS === "android" ? (
          <Text style={[styles.hint, { color: muted }]}>
            Use a native build (`bun run android`) for background watch and source-app names. Expo Go
            cannot include those modules.
          </Text>
        ) : null}

        {!vault.unlocked && watchAvailable ? (
          <Text style={[styles.hint, { color: muted }]}>Unlock your vault to enable background watch.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  navSide: { width: 72, paddingHorizontal: 8, justifyContent: "center" },
  navLink: { color: colors.link, fontSize: 17, fontWeight: "400" },
  navTitle: { fontSize: 17, fontWeight: "600" },
  hint: {
    marginTop: 12,
    marginHorizontal: 32,
    fontSize: 13,
    lineHeight: 18,
  },
});
