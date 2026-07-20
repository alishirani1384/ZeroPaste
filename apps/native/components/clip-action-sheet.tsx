import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "@/contexts/app-theme-context";
import { colors, radii } from "@/lib/theme";

export type ClipAction = "preview" | "copy" | "plain" | "pin" | "delete";

type Props = {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onAction: (action: ClipAction) => void;
};

const ACTIONS: { id: ClipAction; label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean }[] = [
  { id: "preview", label: "Preview", icon: "eye-outline" },
  { id: "copy", label: "Copy", icon: "copy-outline" },
  { id: "plain", label: "Copy as plain text", icon: "document-text-outline" },
  { id: "pin", label: "Pin to board…", icon: "bookmark-outline" },
  { id: "delete", label: "Delete", icon: "trash-outline", danger: true },
];

export function ClipActionSheet({ visible, title, onClose, onAction }: Props) {
  const { isDark } = useAppTheme();
  const ink = isDark ? colors.inkDark : colors.inkLight;
  const muted = isDark ? colors.mutedDark : colors.mutedLight;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? colors.cardDark : colors.cardLight,
              borderColor: isDark ? colors.lineDark : colors.lineLight,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {title ? (
            <Text style={[styles.title, { color: muted }]} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {ACTIONS.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                onAction(a.id);
                onClose();
              }}
              style={styles.row}
            >
              <Ionicons name={a.icon} size={20} color={a.danger ? colors.crimson : ink} />
              <Text style={[styles.label, { color: a.danger ? colors.crimson : ink }]}>{a.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
    padding: 16,
  },
  sheet: {
    borderRadius: radii.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    marginBottom: 24,
  },
  title: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "500",
  },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
  },
  label: {
    fontSize: 17,
    fontWeight: "500",
  },
});
