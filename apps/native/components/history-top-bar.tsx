import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useAppTheme } from "@/contexts/app-theme-context";
import { colors } from "@/lib/theme";

type Props = {
  /** When on History board, show clock icon; otherwise pinboard color. */
  boardColor?: string | null;
  query: string;
  onQuery: (q: string) => void;
  onOpenBoards: () => void;
  onAccount: () => void;
};

const SEARCH_WIDTH = 200;

/** Paste-style top chrome: board icon · fixed search · Account. */
export function HistoryTopBar({ boardColor, query, onQuery, onOpenBoards, onAccount }: Props) {
  const { isDark } = useAppTheme();
  const ink = isDark ? colors.inkDark : colors.inkLight;
  const muted = isDark ? colors.mutedDark : colors.mutedLight;
  const fieldBg = isDark ? "rgba(118,118,128,0.24)" : "rgba(118,118,128,0.12)";

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onOpenBoards}
        style={styles.boardBtn}
        hitSlop={8}
        accessibilityLabel={boardColor ? "Pinboard" : "History"}
      >
        {boardColor ? (
          <View style={[styles.boardDot, { backgroundColor: boardColor }]} />
        ) : (
          <Ionicons name="albums-outline" size={24} color={ink} />
        )}
        <Ionicons name="chevron-down" size={12} color={muted} style={{ marginLeft: 2 }} />
      </Pressable>

      <View style={styles.center}>
        <View style={[styles.search, { backgroundColor: fieldBg, width: SEARCH_WIDTH }]}>
          <Ionicons name="search" size={16} color={muted} style={{ marginLeft: 10 }} />
          <TextInput
            value={query}
            onChangeText={onQuery}
            placeholder="Search"
            placeholderTextColor={muted}
            style={[styles.input, { color: ink }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => onQuery("")} hitSlop={8} style={styles.clear}>
              <Ionicons name="close-circle" size={16} color={muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Pressable onPress={onAccount} style={styles.accountBtn} accessibilityLabel="Account" hitSlop={6}>
        <Ionicons name="person-circle-outline" size={28} color={ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  boardBtn: {
    width: 48,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  boardDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    height: 36,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 16,
    paddingVertical: 0,
  },
  clear: { paddingRight: 8, paddingLeft: 4 },
  accountBtn: {
    width: 48,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
