import "@/lib/crypto-polyfill";
import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { Argon2WebViewBridge } from "@/components/argon2-webview-bridge";
import { ClipboardWatchController } from "@/components/clipboard-watch-controller";
import { AppThemeProvider, useAppTheme } from "@/contexts/app-theme-context";
import { AuthProvider } from "@/contexts/auth-context";
import { ClipStoreProvider } from "@/contexts/clip-store";
import { VaultProvider } from "@/contexts/vault-context";

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

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AppThemeProvider>
          <HeroUINativeProvider>
            <Argon2WebViewBridge />
            <AuthProvider>
              <VaultProvider>
                <ClipStoreProvider>
                  <ClipboardWatchController />
                  <RootStack />
                </ClipStoreProvider>
              </VaultProvider>
            </AuthProvider>
          </HeroUINativeProvider>
        </AppThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
