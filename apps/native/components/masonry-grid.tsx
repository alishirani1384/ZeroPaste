import type { ClipItem } from "@paste/clipboard-core";
import { useMemo, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  data: ClipItem[];
  columns?: number;
  gutter?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  ListEmptyComponent?: ReactNode;
  renderItem: (item: ClipItem) => ReactNode;
};

/** Estimate card height so we can pack a masonry gallery without measuring. */
function estimateHeight(clip: ClipItem): number {
  const header = 54;
  switch (clip.kind) {
    case "image":
      return header + 168;
    case "link":
      return header + 118 + 64;
    case "code":
      return header + 160;
    case "color":
      return header + 150;
    case "file":
      return header + 100;
    case "text":
    case "other":
    default: {
      const len = (clip.body || clip.preview || "").length;
      const lines = Math.min(7, Math.max(3, Math.ceil(len / 42)));
      return header + 28 + lines * 18 + 28;
    }
  }
}

/**
 * Two-column masonry: shortest-column packing, independent card heights.
 */
export function MasonryGrid({
  data,
  columns = 2,
  gutter = 10,
  contentContainerStyle,
  ListEmptyComponent,
  renderItem,
}: Props) {
  const cols = useMemo(() => {
    const heights = Array.from({ length: columns }, () => 0);
    const buckets: ClipItem[][] = Array.from({ length: columns }, () => []);
    for (const item of data) {
      let shortest = 0;
      for (let i = 1; i < columns; i++) {
        if (heights[i]! < heights[shortest]!) shortest = i;
      }
      buckets[shortest]!.push(item);
      heights[shortest]! += estimateHeight(item) + gutter;
    }
    return buckets;
  }, [columns, data, gutter]);

  if (data.length === 0) {
    return (
      <ScrollView contentContainerStyle={contentContainerStyle} showsVerticalScrollIndicator={false}>
        {ListEmptyComponent}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={contentContainerStyle} showsVerticalScrollIndicator={false}>
      <View style={[styles.row, { gap: gutter }]}>
        {cols.map((col, colIndex) => (
          <View key={colIndex} style={styles.col}>
            {col.map((item) => (
              <View key={item.id} style={{ marginBottom: gutter }}>
                {renderItem(item)}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  col: { flex: 1, minWidth: 0 },
});
