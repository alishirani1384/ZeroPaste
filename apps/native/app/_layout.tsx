import "@/lib/crypto-polyfill";
import "@/global.css";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect, type ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { Argon2WebViewBridge } from "@/components/argon2-webview-bridge";
import { ClipboardWatchController } from "@/components/clipboard-watch-controller";
import { AppThemeProvider, useAppTheme } from "@/contexts/app-theme-context";
import { AuthProvider } from "@/contexts/auth-context";
import { ClipStoreProvider } from "@/contexts/clip-store";
import { VaultProvider, useVault } from "@/contexts/vault-context";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export const unstable_settings = {
  initialRouteName: "index",
};

function RootStack() {
  const { isDark } = useAppTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="account" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

/** Keep the native splash up until vault storage has hydrated (avoids white flash / early JS work). */
function SplashGate({ children }: { children: ReactNode }) {
  const vault = useVault();

  useEffect(() => {
    if (!vault.ready) return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [vault.ready]);

  // Safety: never leave the user stuck on splash if storage hangs.
  useEffect(() => {
    const t = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  return <>{children}</>;
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AppThemeProvider>
          <HeroUINativeProvider>
            <Argon2WebViewBridge />
            <AuthProvider>
              <VaultProvider>
                <SplashGate>
                  <ClipStoreProvider>
                    <ClipboardWatchController />
                    <RootStack />
                  </ClipStoreProvider>
                </SplashGate>
              </VaultProvider>
            </AuthProvider>
          </HeroUINativeProvider>
        </AppThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
