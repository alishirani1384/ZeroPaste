import { detectCodeLanguage } from "@/lib/detect-language";
import { highlightToLines } from "@/lib/syntax-lines";
import { SYNTAX_CANVAS, SYNTAX_FG } from "@/lib/syntax-theme";
import { useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

const FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
})!;

type Props = {
  code: string;
  language?: string | null;
  /** Max lines to show (cards). */
  maxLines?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/**
 * Line-based Highlight.js (via lowlight) renderer.
 * Each source line is its own Text row — never collapses to a one-liner.
 */
export function CodeHighlight({ code, language, maxLines, style, textStyle }: Props) {
  const detected = useMemo(() => detectCodeLanguage(code, language), [code, language]);
  const lines = useMemo(() => {
    const all = highlightToLines(code, detected.id);
    if (maxLines != null && all.length > maxLines) {
      return [...all.slice(0, maxLines), [{ text: "…", color: "#8B949E" }]];
    }
    return all;
  }, [code, detected.id, maxLines]);

  return (
    <View style={[styles.canvas, style]}>
      {lines.map((line, i) => (
        <Text
          key={i}
          style={[styles.line, textStyle]}
          numberOfLines={1}
          ellipsizeMode="clip"
        >
          {line.map((tok, j) => (
            <Text key={j} style={{ color: tok.color }}>
              {tok.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

export { detectCodeLanguage } from "@/lib/detect-language";
export { EditableCodeField } from "@/components/editable-code-field";

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: SYNTAX_CANVAS,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  line: {
    fontFamily: FONT,
    fontSize: 11,
    lineHeight: 16,
    color: SYNTAX_FG,
  },
});
