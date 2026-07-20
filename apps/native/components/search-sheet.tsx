import type { ClipKind } from "@paste/clipboard-core";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/contexts/app-theme-context";
import { colors, radii } from "@/lib/theme";

const KINDS: { id: ClipKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "text", label: "Text" },
  { id: "link", label: "Links" },
  { id: "code", label: "Code" },
  { id: "image", label: "Images" },
  { id: "color", label: "Colors" },
];

type Props = {
  visible: boolean;
  query: string;
  kind: ClipKind | "all";
  onQuery: (q: string) => void;
  onKind: (k: ClipKind | "all") => void;
  onClose: () => void;
};

export function SearchSheet({ visible, query, kind, onQuery, onKind, onClose }: Props) {
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const ink = isDark ? colors.inkDark : colors.inkLight;
  const muted = isDark ? colors.mutedDark : colors.mutedLight;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8, backgroundColor: isDark ? "rgba(0,0,0,0.72)" : "rgba(244,245,247,0.92)" }]}>
        <View style={styles.row}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={onQuery}
            placeholder="Search titles, content, apps…"
            placeholderTextColor={muted}
            style={[
              styles.input,
              {
                color: ink,
                backgroundColor: isDark ? colors.cardDark : colors.cardLight,
                borderColor: isDark ? colors.lineDark : colors.lineLight,
              },
            ]}
          />
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: colors.crimson, fontSize: 17, fontWeight: "600" }}>Done</Text>
          </Pressable>
        </View>
        <View style={styles.filters}>
          {KINDS.map((k) => {
            const active = kind === k.id;
            return (
              <Pressable
                key={k.id}
                onPress={() => onKind(k.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.crimson : isDark ? colors.cardDark : colors.cardLight,
                    borderColor: isDark ? colors.lineDark : colors.lineLight,
                  },
                ]}
              >
                <Text style={{ color: active ? "#fff" : ink, fontSize: 13, fontWeight: "600" }}>{k.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
