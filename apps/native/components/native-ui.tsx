import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useAppTheme } from "@/contexts/app-theme-context";
import { colors, radii } from "@/lib/theme";

/** iOS Settings section caption. */
export function SettingsSection({
  title,
  footer,
  children,
  style,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { isDark } = useAppTheme();
  const muted = isDark ? colors.mutedDark : colors.mutedLight;
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={[styles.sectionTitle, { color: muted }]}>{title}</Text> : null}
      <View
        style={[
          styles.group,
          {
            backgroundColor: isDark ? colors.cardDark : colors.cardLight,
          },
        ]}
      >
        {children}
      </View>
      {footer ? <Text style={[styles.sectionFooter, { color: muted }]}>{footer}</Text> : null}
    </View>
  );
}

export function SettingsRow({
  label,
  value,
  onPress,
  destructive,
  showChevron,
  switchValue,
  onSwitch,
  disabled,
  last,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  switchValue?: boolean;
  onSwitch?: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  const { isDark } = useAppTheme();
  const ink = isDark ? colors.inkDark : colors.inkLight;
  const muted = isDark ? colors.mutedDark : colors.mutedLight;
  const line = isDark ? colors.lineDark : colors.lineLight;
  const labelColor = destructive ? colors.crimson : ink;

  const chevron = showChevron ?? Boolean(onPress && typeof switchValue !== "boolean" && !destructive);
  const bodyWithChevron = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: line }]}>
      <Text style={[styles.rowLabel, { color: labelColor, opacity: disabled ? 0.45 : 1 }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: muted }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {typeof switchValue === "boolean" && onSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitch}
            disabled={disabled}
            trackColor={{ false: isDark ? "#39393D" : "#E9E9EA", true: colors.success }}
            thumbColor="#FFFFFF"
          />
        ) : null}
        {chevron ? <Ionicons name="chevron-forward" size={18} color={muted} /> : null}
      </View>
    </View>
  );

  if (onPress && typeof switchValue !== "boolean") {
    return (
      <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
        {bodyWithChevron}
      </Pressable>
    );
  }
  return bodyWithChevron;
}

export function NativeButton({
  label,
  onPress,
  variant = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  disabled?: boolean;
}) {
  const { isDark } = useAppTheme();
  const bg =
    variant === "primary"
      ? isDark
        ? "#FFFFFF"
        : colors.primary
      : variant === "destructive"
        ? "transparent"
        : variant === "secondary"
          ? isDark
            ? colors.cardDark
            : colors.cardLight
          : "transparent";
  const fg =
    variant === "primary"
      ? isDark
        ? "#000000"
        : colors.primaryFg
      : variant === "destructive"
        ? colors.crimson
        : isDark
          ? colors.inkDark
          : colors.inkLight;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderWidth: variant === "secondary" ? StyleSheet.hairlineWidth : 0,
          borderColor: isDark ? colors.lineDark : colors.lineLight,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "400",
    textTransform: "uppercase",
    letterSpacing: 0.2,
    marginBottom: 8,
    marginLeft: 16,
  },
  sectionFooter: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    marginHorizontal: 16,
  },
  group: {
    borderRadius: radii.card,
    overflow: "hidden",
  },
  row: {
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLabel: { fontSize: 17, fontWeight: "400", flexShrink: 0 },
  rowRight: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  rowValue: { fontSize: 17, flexShrink: 1, textAlign: "right" },
  btn: {
    marginTop: 12,
    height: 50,
    borderRadius: radii.control,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 17, fontWeight: "600" },
});
