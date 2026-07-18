import {
  searchClips,
  SEED_CLIPS,
  SEED_PINBOARDS,
  type ClipItem,
} from "@paste/clipboard-core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ClipRow } from "@/components/clip-row";
import { captureClipboardIfChanged } from "@/lib/clipboard-capture";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [boardId, setBoardId] = useState<string>("history");
  const [clipsLocal, setClipsLocal] = useState<ClipItem[]>(SEED_CLIPS);

  const ingest = useCallback(async () => {
    try {
      const clip = await captureClipboardIfChanged();
      if (!clip) return;
      setClipsLocal((prev) => {
        if (prev.some((c) => c.contentHash === clip.contentHash && !c.deletedAt)) {
          return [
            { ...clip, id: prev.find((c) => c.contentHash === clip.contentHash)!.id },
            ...prev.filter((c) => c.contentHash !== clip.contentHash),
          ];
        }
        return [clip, ...prev];
      });
    } catch (err) {
      console.warn("[capture]", err);
    }
  }, []);

  useEffect(() => {
    void ingest();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void ingest();
    });
    return () => sub.remove();
  }, [ingest]);

  const clips = useMemo(
    () =>
      searchClips(clipsLocal, {
        query,
        boardId: boardId === "history" ? undefined : boardId,
      }),
    [clipsLocal, query, boardId],
  );

  return (
    <View className="flex-1 bg-zinc-100 dark:bg-black" style={{ paddingTop: insets.top }}>
      <View className="px-5 pb-3 pt-4">
        <Text className="text-[28px] font-bold tracking-tight text-zinc-900 dark:text-white">
          ZeroPaste
        </Text>
        <Text className="mt-1 text-[14px] text-zinc-500">
          Tap to copy · captures when you return to the app
        </Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search titles, content, apps…"
          placeholderTextColor="#8E8E93"
          className="mt-4 h-11 rounded-full border border-black/8 bg-white px-4 text-[15px] text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
        />

        <View className="mt-3 flex-row flex-wrap gap-2">
          <BoardChip
            label="History"
            active={boardId === "history"}
            onPress={() => setBoardId("history")}
          />
          {SEED_PINBOARDS.map((b) => (
            <BoardChip
              key={b.id}
              label={b.name}
              color={b.color}
              active={boardId === b.id}
              onPress={() => setBoardId(b.id)}
            />
          ))}
        </View>
      </View>

      <FlatList
        data={clips}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 pb-10"
        ListEmptyComponent={
          <View className="mt-16 items-center px-8">
            <Text className="text-center text-[17px] font-semibold text-zinc-900 dark:text-white">
              Nothing here yet
            </Text>
            <Text className="mt-2 text-center text-[14px] leading-5 text-zinc-500">
              Copy something in another app, then open ZeroPaste to capture it.
            </Text>
          </View>
        }
        renderItem={({ item }) => <ClipRow clip={item} />}
      />
    </View>
  );
}

function BoardChip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={[
        "h-8 flex-row items-center gap-1.5 rounded-full px-3",
        active ? "bg-zinc-900 dark:bg-white" : "bg-white dark:bg-zinc-900",
      ].join(" ")}
    >
      {color ? <View className="size-2 rounded-full" style={{ backgroundColor: color }} /> : null}
      <Text
        className={[
          "text-[12px] font-semibold",
          active ? "text-white dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-300",
        ].join(" ")}
      >
        {label}
      </Text>
    </Pressable>
  );
}
