// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * SF Symbols → Material Icons mapping for Shorts Detox app.
 */
const MAPPING = {
  // Navigation
  "house.fill": "home",
  "timer": "timer",
  "brain.head.profile": "psychology",
  "chart.bar.fill": "bar-chart",
  "gearshape.fill": "settings",
  // General
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "xmark": "close",
  "xmark.circle.fill": "cancel",
  "checkmark.circle.fill": "check-circle",
  "play.fill": "play-arrow",
  "pause.fill": "pause",
  "stop.fill": "stop",
  "arrow.clockwise": "refresh",
  "plus": "add",
  "minus": "remove",
  "bell.fill": "notifications",
  "bell.slash.fill": "notifications-off",
  "moon.fill": "dark-mode",
  "sun.max.fill": "light-mode",
  "person.fill": "person",
  "star.fill": "star",
  "flame.fill": "local-fire-department",
  "trophy.fill": "emoji-events",
  "bolt.fill": "bolt",
  "heart.fill": "favorite",
  "info.circle": "info",
  "arrow.right": "arrow-forward",
  "target": "my-location",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
