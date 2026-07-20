import {
  searchClips,
  type ClipItem,
  type ClipKind,
  type Pinboard,
} from "@paste/clipboard-core";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoardPicker } from "@/components/board-picker";
import { ClipActionSheet, type ClipAction } from "@/components/clip-action-sheet";
import { ClipCard } from "@/components/clip-card";
import { HistoryTopBar } from "@/components/history-top-bar";
import { MasonryGrid } from "@/components/masonry-grid";
import { QuickLook } from "@/components/quick-look";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useClipStore } from "@/contexts/clip-store";
import { useVault } from "@/contexts/vault-context";
import {
  bindForegroundTracking,
  captureClipboardIfChanged,
  copyClipToClipboard,
  rememberContentHash,
} from "@/lib/clipboard-capture";
import { colors } from "@/lib/theme";

const GUTTER = 10;
const H_PAD = 12;

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useAppTheme();
  const vault = useVault();
  const store = useClipStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [query, setQuery] = useState("");
  const [kind] = useState<ClipKind | "all">("all");
  const [boardId, setBoardId] = useState("history");
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [menuClip, setMenuClip] = useState<ClipItem | null>(null);
  const [quickLook, setQuickLook] = useState<ClipItem | null>(null);
  const [pinTarget, setPinTarget] = useState<ClipItem | null>(null);

  const ingest = useCallback(async () => {
    if (!vault.unlocked || vault.recoveryKeyOnce) return;
    try {
      const clip = await captureClipboardIfChanged();
      if (!clip) return;
      store.upsertClip(clip);
      void Haptics.selectionAsync();
    } catch (err) {
      console.warn("[capture]", err);
    }
  }, [store, vault.unlocked, vault.recoveryKeyOnce]);

  const ingestWithRetries = useCallback(() => {
    void ingest();
    const t1 = setTimeout(() => void ingest(), 350);
    const t2 = setTimeout(() => void ingest(), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ingest]);

  useEffect(() => {
    if (!store.ready) return;
    const newest = store.clips.find((c) => !c.deletedAt);
    rememberContentHash(newest?.contentHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ready]);

  useEffect(() => {
    if (!vault.unlocked || vault.recoveryKeyOnce) return;

    const clearRetries = ingestWithRetries();
    const unbind = bindForegroundTracking();

    const startPoll = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => void ingest(), 1600);
    };
    const stopPoll = () => {
      if (!pollRef.current) return;
      clearInterval(pollRef.current);
      pollRef.current = null;
    };

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        ingestWithRetries();
        startPoll();
      } else {
        stopPoll();
      }
    });

    if (AppState.currentState === "active") startPoll();

    return () => {
      clearRetries();
      unbind();
      sub.remove();
      stopPoll();
    };
  }, [vault.unlocked, vault.recoveryKeyOnce, ingest, ingestWithRetries]);

  const activeBoard = boardId === "history" ? null : store.pinboards.find((b) => b.id === boardId);
  const boardColor = activeBoard?.color ?? null;

  const clips = useMemo(() => {
    return searchClips(store.clips, {
      query,
      boardId: boardId === "history" ? undefined : boardId,
      kinds: kind === "all" ? undefined : [kind],
    }).filter((c) => !c.deletedAt);
  }, [store.clips, query, boardId, kind]);

  const onCopy = async (clip: ClipItem) => {
    await copyClipToClipboard(clip);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const onAction = (action: ClipAction) => {
    const clip = menuClip;
    if (!clip) return;
    if (action === "preview") setQuickLook(clip);
    if (action === "copy") void onCopy(clip);
    if (action === "plain") {
      void Clipboard.setStringAsync(clip.body || clip.preview || clip.title);
      void Haptics.selectionAsync();
    }
    if (action === "pin") setPinTarget(clip);
    if (action === "delete") {
      Alert.alert("Delete clip?", "This removes it from history on this device.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => store.softDeleteClip(clip.id),
        },
      ]);
    }
  };

  const createBoard = (name: string, color: string) => {
    const board: Pinboard = {
      id:
        typeof globalThis.crypto?.randomUUID === "function"
          ? globalThis.crypto.randomUUID()
          : `board_${Date.now().toString(16)}`,
      name,
      color,
      createdAt: new Date().toISOString(),
      sortOrder: store.pinboards.length + 1,
    };
    store.upsertPinboard(board);
    setBoardId(board.id);
  };

  const bg = isDark ? colors.bgDark : "#EFEFF4";

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <HistoryTopBar
          boardColor={boardColor}
          query={query}
          onQuery={setQuery}
          onOpenBoards={() => setBoardsOpen(true)}
          onAccount={() => router.push("/account")}
        />
      </View>

      <MasonryGrid
        data={clips}
        gutter={GUTTER}
        contentContainerStyle={{
          paddingHorizontal: H_PAD,
          paddingBottom: 100 + insets.bottom,
          paddingTop: 4,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: isDark ? colors.inkDark : colors.inkLight }]}>
              Nothing here yet
            </Text>
            <Text style={[styles.emptyBody, { color: isDark ? colors.mutedDark : colors.mutedLight }]}>
              Copy something in another app, then switch back — or tap + to capture now.
            </Text>
          </View>
        }
        renderItem={(item) => (
          <ClipCard
            clip={item}
            onPress={() => void onCopy(item)}
            onLongPress={() => setMenuClip(item)}
          />
        )}
      />

      <Pressable
        style={[styles.fab, { bottom: Math.max(insets.bottom, 16) + 8 }]}
        onPress={() => {
          void (async () => {
            await ingest();
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          })();
        }}
        accessibilityLabel="Capture clipboard"
      >
        <Ionicons name="add" size={32} color={colors.fabFg} />
      </Pressable>

      <BoardPicker
        visible={boardsOpen || !!pinTarget}
        boards={store.pinboards}
        activeId={pinTarget ? "" : boardId}
        pinMode={!!pinTarget}
        onClose={() => {
          setBoardsOpen(false);
          setPinTarget(null);
        }}
        onSelect={(id) => {
          if (pinTarget) {
            if (id === "history") return;
            store.pinClipToBoard(pinTarget.id, id);
            setPinTarget(null);
            void Haptics.selectionAsync();
            return;
          }
          setBoardId(id);
        }}
        onCreate={createBoard}
      />

      <ClipActionSheet
        visible={!!menuClip}
        title={menuClip?.title}
        onClose={() => setMenuClip(null)}
        onAction={onAction}
      />

      <QuickLook
        clip={quickLook}
        visible={!!quickLook}
        onClose={() => setQuickLook(null)}
        onSave={({ title, body }) => {
          if (!quickLook) return;
          store.updateClip(quickLook.id, {
            title,
            body,
            preview: body.slice(0, 180),
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { marginTop: 80, paddingHorizontal: 28, alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  emptyBody: { marginTop: 8, fontSize: 15, lineHeight: 21, textAlign: "center" },
  fab: {
    position: "absolute",
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.fab,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
