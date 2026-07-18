import type { ClipItem } from "@paste/clipboard-core";
import { formatRelativeTime } from "@paste/clipboard-core";
import * as Clipboard from "expo-clipboard";
import { Pressable, Text, View } from "react-native";

type Props = {
  clip: ClipItem;
  onLongPress?: () => void;
};

export function ClipRow({ clip, onLongPress }: Props) {
  return (
    <Pressable
      onPress={() => {
        void Clipboard.setStringAsync(clip.kind === "image" ? clip.title : clip.body);
      }}
      onLongPress={onLongPress}
      className="mb-3 overflow-hidden rounded-2xl border border-black/8 bg-white active:opacity-90 dark:border-white/10 dark:bg-zinc-900"
    >
      <View className="min-h-[88px] px-4 py-3">
        {clip.kind === "color" ? (
          <View className="mb-2 h-10 rounded-xl" style={{ backgroundColor: clip.body }} />
        ) : null}
        <Text className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50" numberOfLines={2}>
          {clip.title}
        </Text>
        {clip.kind !== "color" && clip.kind !== "image" ? (
          <Text className="mt-1 text-[13px] leading-5 text-zinc-500 dark:text-zinc-400" numberOfLines={3}>
            {clip.preview}
          </Text>
        ) : null}
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            {clip.kind} · {clip.source.appName}
          </Text>
          <Text className="text-[11px] text-zinc-400">{formatRelativeTime(clip.createdAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}
