import type { ClipKind } from "@paste/clipboard-core";
import { Image, StyleSheet, type ImageSourcePropType, type StyleProp, type ImageStyle } from "react-native";

const TYPE_ICONS: Partial<Record<ClipKind, ImageSourcePropType>> = {
  link: require("../assets/type/link.jpg"),
  text: require("../assets/type/text.jpg"),
  image: require("../assets/type/image.jpg"),
  code: require("../assets/type/code.jpg"),
  other: require("../assets/type/text.jpg"),
  file: require("../assets/type/text.jpg"),
  color: require("../assets/type/color.jpg"),
};

type Props = {
  kind: ClipKind;
  style?: StyleProp<ImageStyle>;
};

/** Type artwork flush to the card header (top-right, full header height). */
export function KindTypeIcon({ kind, style }: Props) {
  const source = TYPE_ICONS[kind] ?? TYPE_ICONS.text!;
  return <Image source={source} style={[styles.icon, style]} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  icon: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 9.5,
    borderBottomLeftRadius: 9.5,
  },
});
