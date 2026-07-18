import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function AccountScreen() {
  return (
    <Container className="p-6">
      <View className="flex-1 justify-center gap-3">
        <Text className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Account
        </Text>
        <Text className="text-[15px] leading-6 text-zinc-500">
          Vault unlock and Supabase sign-in mirror the desktop app. Set{" "}
          <Text className="font-semibold text-zinc-700 dark:text-zinc-300">
            EXPO_PUBLIC_SUPABASE_URL
          </Text>{" "}
          and{" "}
          <Text className="font-semibold text-zinc-700 dark:text-zinc-300">
            EXPO_PUBLIC_SUPABASE_ANON_KEY
          </Text>{" "}
          after applying migrations. Until then, history stays on-device with capture-on-focus.
        </Text>
      </View>
    </Container>
  );
}
