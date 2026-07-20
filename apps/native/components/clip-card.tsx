import type { ClipItem } from "@paste/clipboard-core";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { CodeHighlight, detectCodeLanguage } from "@/components/code-highlight";
import { KindTypeIcon } from "@/components/kind-type-icon";
import {
  characterCountLabel,
  imageSizeLabel,
  kindChrome,
  linkPathLabel,
  pasteRelativeTime,
} from "@/lib/clip-card-meta";
import { pickImageSource, useResolvedImageUri } from "@/lib/image-uri";
import { useImageSize, useLinkPreview } from "@/lib/use-clip-media";

type Props = {
  clip: ClipItem;
  onPress: () => void;
  onLongPress: () => void;
};

export function ClipCard({ clip, onPress, onLongPress }: Props) {
  const chrome = kindChrome(clip.kind);
  const when = pasteRelativeTime(clip.createdAt);

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      onLongPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPress();
      }}
      delayLongPress={280}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
    >
      <View style={[styles.header, { backgroundColor: chrome.header }]}>
        <View style={styles.headerText}>
          <Text style={styles.kindLabel}>{chrome.label}</Text>
          <Text style={styles.when}>{when}</Text>
        </View>
        <View style={styles.typeIcon}>
          <KindTypeIcon kind={clip.kind} />
        </View>
      </View>

      {clip.kind === "link" ? <LinkBody clip={clip} /> : null}
      {clip.kind === "text" || clip.kind === "other" ? <TextBody clip={clip} /> : null}
      {clip.kind === "image" ? <ImageBody clip={clip} /> : null}
      {clip.kind === "code" ? <CodeBody clip={clip} /> : null}
      {clip.kind === "color" ? <ColorBody clip={clip} /> : null}
      {clip.kind === "file" ? <FileBody clip={clip} /> : null}
    </Pressable>
  );
}

function LinkBody({ clip }: { clip: ClipItem }) {
  const { preview } = useLinkPreview(clip.body, true);
  const title = preview?.title?.trim() || clip.title;
  const image = preview?.image;
  const path = linkPathLabel(clip.body);

  return (
    <View style={styles.linkBody}>
      {image ? (
        <Image source={{ uri: image }} style={styles.linkImage} resizeMode="cover" />
      ) : (
        <View style={styles.linkImageFallback}>
          <Text style={styles.linkFallbackHost} numberOfLines={2}>
            {path}
          </Text>
        </View>
      )}
      <View style={styles.linkFooter}>
        <Text style={styles.linkTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.linkUrl} numberOfLines={1}>
          {path}
        </Text>
      </View>
    </View>
  );
}

function TextBody({ clip }: { clip: ClipItem }) {
  const body = clip.body || clip.preview || "";
  return (
    <View style={styles.textBody}>
      <View style={styles.textPad}>
        <Text style={styles.textContent} numberOfLines={7}>
          {body}
        </Text>
        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,1)"]}
          style={styles.textFade}
          pointerEvents="none"
        />
      </View>
      <Text style={styles.charCount}>{characterCountLabel(body)}</Text>
    </View>
  );
}

function ImageBody({ clip }: { clip: ClipItem }) {
  const raw = pickImageSource(clip);
  const { uri, loading } = useResolvedImageUri(raw, clip.id);
  const size = useImageSize(uri ?? undefined, {
    w: clip.imageWidth,
    h: clip.imageHeight,
  });
  const label = imageSizeLabel(size?.w, size?.h);

  return (
    <View style={styles.imageBody}>
      {uri ? (
        <Image source={{ uri }} style={styles.imageFill} resizeMode="cover" />
      ) : (
        <View style={[styles.imageFill, styles.imageMissing]}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>{loading ? "…" : "Image"}</Text>
        </View>
      )}
      {label ? (
        <View style={styles.sizePillWrap} pointerEvents="none">
          <View style={styles.sizePill}>
            <Text style={styles.sizePillText}>{label}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function CodeBody({ clip }: { clip: ClipItem }) {
  const code = clip.body || clip.preview || "";
  const { label } = detectCodeLanguage(code, clip.language);
  return (
    <View style={styles.codeBody}>
      <CodeHighlight
        code={code}
        language={clip.language}
        maxLines={9}
        style={styles.codePad}
        textStyle={styles.codeText}
      />
      <Text style={styles.langLabel}>{label}</Text>
    </View>
  );
}

function ColorBody({ clip }: { clip: ClipItem }) {
  return (
    <View style={styles.colorBody}>
      <View style={[styles.colorSwatch, { backgroundColor: clip.body }]} />
      <Text style={styles.colorHex}>{clip.body}</Text>
    </View>
  );
}

function FileBody({ clip }: { clip: ClipItem }) {
  return (
    <View style={styles.fileBody}>
      <Text style={styles.fileTitle} numberOfLines={3}>
        {clip.title || clip.preview}
      </Text>
    </View>
  );
}

const CARD_RADIUS = 16;

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  header: {
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  headerText: { flex: 1, paddingRight: 58, zIndex: 1 },
  kindLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  when: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  typeIcon: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 54,
  },
  linkBody: { backgroundColor: "#FFFFFF" },
  linkImage: { width: "100%", height: 118, backgroundColor: "#E8E8ED" },
  linkImageFallback: {
    width: "100%",
    height: 88,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  linkFallbackHost: { color: "#8E8E93", fontSize: 13, textAlign: "center" },
  linkFooter: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  linkTitle: {
    color: "#1C1C1E",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  linkUrl: { color: "#8E8E93", fontSize: 12, marginTop: 4 },

  textBody: { backgroundColor: "#FFFFFF", minHeight: 160 },
  textPad: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 28, minHeight: 140 },
  textContent: {
    color: "#1C1C1E",
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  textFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
  },
  charCount: {
    textAlign: "center",
    color: "#AEAEB2",
    fontSize: 11,
    fontWeight: "500",
    paddingBottom: 12,
  },

  imageBody: { height: 168, backgroundColor: "#111" },
  imageFill: { ...StyleSheet.absoluteFill },
  imageMissing: { alignItems: "center", justifyContent: "center", backgroundColor: "#333" },
  sizePillWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: "center",
  },
  sizePill: {
    backgroundColor: "rgba(0,0,0,0.52)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sizePillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },

  codeBody: { backgroundColor: "#0D1117", overflow: "hidden" },
  codePad: { minHeight: 140, paddingBottom: 4 },
  codeText: { fontSize: 11, lineHeight: 16 },
  langLabel: {
    textAlign: "center",
    color: "#8B949E",
    fontSize: 11,
    fontWeight: "600",
    paddingBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  colorBody: { backgroundColor: "#FFFFFF", padding: 12, alignItems: "center", gap: 10 },
  colorSwatch: {
    width: "100%",
    height: 110,
    borderRadius: 12,
  },
  colorHex: {
    color: "#1C1C1E",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "monospace",
  },

  fileBody: { backgroundColor: "#FFFFFF", padding: 14, minHeight: 100 },
  fileTitle: { color: "#1C1C1E", fontSize: 14, fontWeight: "600", lineHeight: 20 },
});
