import type { ClipItem } from "@paste/clipboard-core";
import { formatRelativeTime, paintColorForNative } from "@paste/clipboard-core";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EditableCodeField, detectCodeLanguage } from "@/components/code-highlight";
import { useAppTheme } from "@/contexts/app-theme-context";
import { pickImageSource, useResolvedImageUri } from "@/lib/image-uri";
import { colors, radii } from "@/lib/theme";

type Props = {
  clip: ClipItem | null;
  visible: boolean;
  onClose: () => void;
  onSave: (patch: { title: string; body: string }) => void;
};

export function QuickLook({ clip, visible, onClose, onSave }: Props) {
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (clip) {
      setTitle(clip.title);
      setBody(clip.kind === "image" ? "" : clip.body);
    }
  }, [clip]);

  const codeLang = useMemo(
    () => (clip?.kind === "code" ? detectCodeLanguage(body, clip.language) : null),
    [body, clip],
  );

  if (!clip) return null;

  const ink = isDark ? colors.inkDark : colors.inkLight;
  const muted = isDark ? colors.mutedDark : colors.mutedLight;
  const editable = clip.kind === "text" || clip.kind === "link" || clip.kind === "code";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: isDark ? colors.bgDark : colors.bgLight, paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.headerBtn, { color: muted }]}>Close</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: ink }]}>Quick Look</Text>
          {editable ? (
            <Pressable
              onPress={() => {
                onSave({ title: title.trim() || clip.title, body });
                onClose();
              }}
              hitSlop={12}
            >
              <Text style={[styles.headerBtn, { color: colors.crimson, fontWeight: "700" }]}>Save</Text>
            </Pressable>
          ) : (
            <View style={{ width: 48 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {clip.kind === "image" ? (
            <ImagePreview clip={clip} ink={ink} />
          ) : editable ? (
            <>
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={[styles.titleInput, { color: ink, borderColor: isDark ? colors.lineDark : colors.lineLight }]}
                placeholder="Title"
                placeholderTextColor={muted}
              />
              {clip.kind === "code" ? (
                <View style={styles.codeSection}>
                  <Text style={{ color: muted, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
                    {codeLang?.label ?? "Code"}
                  </Text>
                  <EditableCodeField
                    key={clip.id}
                    value={body}
                    onChangeText={setBody}
                    language={clip.language}
                    minHeight={280}
                  />
                </View>
              ) : (
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  multiline
                  textAlignVertical="top"
                  style={[
                    styles.bodyInput,
                    {
                      color: ink,
                      backgroundColor: isDark ? colors.cardDark : colors.cardLight,
                      borderColor: isDark ? colors.lineDark : colors.lineLight,
                    },
                  ]}
                />
              )}
            </>
          ) : clip.kind === "color" ? (
            <>
              <View
                style={[
                  styles.colorSwatch,
                  { backgroundColor: paintColorForNative(clip.body) ?? "#F2F2F7" },
                ]}
              />
              <Text style={[styles.titleInput, { color: ink, borderWidth: 0 }]}>{clip.body}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.titleInput, { color: ink, borderWidth: 0 }]}>{clip.title}</Text>
              <Text style={[styles.bodyReadonly, { color: muted }]} numberOfLines={20}>
                {(clip.preview || clip.body || "").slice(0, 2000)}
              </Text>
            </>
          )}

          <View style={styles.metaBlock}>
            <MetaRow label="Kind" value={clip.kind} muted={muted} ink={ink} />
            {clip.kind === "code" && codeLang ? (
              <MetaRow label="Lang" value={codeLang.label} muted={muted} ink={ink} />
            ) : null}
            <MetaRow label="App" value={clip.source.appName} muted={muted} ink={ink} />
            {clip.source.windowTitle ? (
              <MetaRow label="Window" value={clip.source.windowTitle} muted={muted} ink={ink} />
            ) : null}
            <MetaRow label="Device" value={clip.source.deviceName} muted={muted} ink={ink} />
            <MetaRow label="Copied" value={formatRelativeTime(clip.createdAt)} muted={muted} ink={ink} />
            <MetaRow label="Size" value={formatBytes(clip.byteSize)} muted={muted} ink={ink} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ImagePreview({ clip, ink }: { clip: ClipItem; ink: string }) {
  const raw = pickImageSource(clip);
  const { uri, loading } = useResolvedImageUri(raw, `${clip.id}-ql`);

  return (
    <View style={styles.imageWrap}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={styles.imagePlaceholder}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff" }}>No image</Text>}
        </View>
      )}
      <Text style={[styles.imageTitle, { color: ink }]}>{clip.title || "Image"}</Text>
    </View>
  );
}

function MetaRow({
  label,
  value,
  muted,
  ink,
}: {
  label: string;
  value: string;
  muted: string;
  ink: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: ink }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerBtn: { fontSize: 17, minWidth: 48 },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  titleInput: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  bodyInput: {
    minHeight: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
  },
  codeSection: { marginBottom: 4 },
  bodyReadonly: { fontSize: 16, lineHeight: 22 },
  imageWrap: { marginBottom: 12 },
  image: {
    width: "100%",
    height: 360,
    borderRadius: radii.card,
    backgroundColor: "#111",
  },
  imagePlaceholder: {
    width: "100%",
    height: 280,
    borderRadius: radii.card,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  imageTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
  },
  colorSwatch: {
    height: 160,
    borderRadius: radii.card,
    marginBottom: 12,
  },
  metaBlock: { marginTop: 24, gap: 10 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  metaLabel: { fontSize: 14, fontWeight: "500", width: 72 },
  metaValue: { flex: 1, fontSize: 14, textAlign: "right" },
});
