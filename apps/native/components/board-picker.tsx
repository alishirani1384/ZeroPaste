import type { Pinboard } from "@paste/clipboard-core";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/contexts/app-theme-context";
import { colors, radii } from "@/lib/theme";

type Props = {
  visible: boolean;
  boards: Pinboard[];
  activeId: string;
  /** When pinning a clip, hide History and require a custom board. */
  pinMode?: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: (name: string, color: string) => void;
};

const COLORS = ["#C43B3B", "#E8A838", "#3D9A6A", "#3B82C4", "#8B5CF6", "#EC4899"];

/** Lightweight top-left dropdown — no dimmed overlay. */
export function BoardPicker({ visible, boards, activeId, pinMode, onClose, onSelect, onCreate }: Props) {
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const ink = isDark ? colors.inkDark : colors.inkLight;
  const muted = isDark ? colors.mutedDark : colors.mutedLight;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]!);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.menu,
            {
              top: insets.top + 48,
              left: 12,
              backgroundColor: isDark ? colors.cardDark : "#FFFFFF",
              borderColor: isDark ? colors.lineDark : colors.lineLight,
            },
          ]}
        >
          <Text style={[styles.heading, { color: muted }]}>{pinMode ? "Pin to" : "Boards"}</Text>

          {!pinMode ? (
            <Pressable
              style={[styles.row, activeId === "history" && styles.activeRow]}
              onPress={() => {
                onSelect("history");
                onClose();
              }}
            >
              <Ionicons name="albums-outline" size={18} color={ink} />
              <Text style={[styles.rowLabel, { color: ink }]}>History</Text>
              {activeId === "history" ? (
                <Ionicons name="checkmark" size={18} color={colors.crimson} />
              ) : null}
            </Pressable>
          ) : null}

          {boards.map((b) => (
            <Pressable
              key={b.id}
              style={[styles.row, activeId === b.id && styles.activeRow]}
              onPress={() => {
                onSelect(b.id);
                onClose();
              }}
            >
              <View style={[styles.dot, { backgroundColor: b.color }]} />
              <Text style={[styles.rowLabel, { color: ink }]}>{b.name}</Text>
              {activeId === b.id ? (
                <Ionicons name="checkmark" size={18} color={colors.crimson} />
              ) : null}
            </Pressable>
          ))}

          {creating ? (
            <View style={styles.createBox}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Board name"
                placeholderTextColor={muted}
                style={[styles.input, { color: ink, borderColor: isDark ? colors.lineDark : colors.lineLight }]}
                autoFocus
              />
              <View style={styles.swatches}>
                {COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={[styles.swatch, { backgroundColor: c, borderWidth: color === c ? 2 : 0, borderColor: ink }]}
                  />
                ))}
              </View>
              <Pressable
                style={styles.createBtn}
                onPress={() => {
                  if (!name.trim()) return;
                  onCreate(name.trim(), color);
                  setName("");
                  setCreating(false);
                  onClose();
                }}
              >
                <Text style={styles.createBtnText}>Create</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.row}
              onPress={() => setCreating(true)}
            >
              <Ionicons name="add" size={18} color={colors.crimson} />
              <Text style={[styles.rowLabel, { color: colors.crimson }]}>New pinboard</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  menu: {
    position: "absolute",
    minWidth: 220,
    maxWidth: 280,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  heading: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  activeRow: {
    backgroundColor: "rgba(196,59,59,0.08)",
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: "500" },
  dot: { width: 12, height: 12, borderRadius: 6 },
  createBox: { paddingHorizontal: 14, paddingTop: 8, gap: 12, paddingBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  swatches: { flexDirection: "row", gap: 10 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  createBtn: {
    backgroundColor: colors.crimson,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
  },
  createBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
