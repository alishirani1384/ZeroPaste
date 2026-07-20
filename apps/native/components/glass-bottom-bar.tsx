import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/contexts/app-theme-context";
import { colors, radii } from "@/lib/theme";

type Props = {
  boardLabel: string;
  onOpenBoards: () => void;
  onAdd: () => void;
  onSearch: () => void;
  onAccount: () => void;
};

export function GlassBottomBar({ boardLabel, onOpenBoards, onAdd, onSearch, onAccount }: Props) {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={[styles.bar, isDark ? styles.barDark : styles.barLight]}>
        <BlurView intensity={isDark ? 40 : 55} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <Pressable onPress={onOpenBoards} style={styles.boardBtn} hitSlop={8}>
          <Text style={[styles.boardLabel, { color: isDark ? colors.inkDark : colors.inkLight }]} numberOfLines={1}>
            {boardLabel}
          </Text>
          <Ionicons name="chevron-up" size={14} color={isDark ? colors.mutedDark : colors.mutedLight} />
        </Pressable>

        <Pressable onPress={onAdd} style={styles.plus} accessibilityLabel="Add clip">
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>

        <View style={styles.right}>
          <Pressable onPress={onSearch} style={styles.iconBtn} accessibilityLabel="Search">
            <Ionicons name="search" size={22} color={isDark ? colors.inkDark : colors.inkLight} />
          </Pressable>
          <Pressable onPress={onAccount} style={styles.iconBtn} accessibilityLabel="Account">
            <Ionicons name="person-circle-outline" size={24} color={isDark ? colors.inkDark : colors.inkLight} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
  },
  bar: {
    height: 64,
    borderRadius: radii.bar,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  barLight: {
    backgroundColor: colors.glassLight,
    borderColor: colors.lineLight,
  },
  barDark: {
    backgroundColor: colors.glassDark,
    borderColor: colors.lineDark,
  },
  boardBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 48,
    paddingHorizontal: 8,
  },
  boardLabel: {
    fontSize: 16,
    fontWeight: "600",
    maxWidth: 120,
  },
  plus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.crimson,
    alignItems: "center",
    justifyContent: "center",
  },
  right: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 2,
  },
  iconBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
