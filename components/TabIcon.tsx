// components/TabIcon.tsx
import type { IconProps } from "phosphor-react-native";
import {
    GearSix,
    House,
    MapTrifold,
    PlusCircle,
    User,
} from "phosphor-react-native";
import type { ComponentType } from "react";
import { View } from "react-native";

type IconKey = "home" | "map" | "post" | "profile" | "settings";

const ICONS: Record<IconKey, ComponentType<IconProps>> = {
  home: House,
  map: MapTrifold,
  post: PlusCircle,
  profile: User,
  settings: GearSix,
};

export default function TabIcon({
  name,
  focused,
  size = 26,
  color = "#111827", // neutral-900
}: {
  name: IconKey;
  focused: boolean;
  size?: number;
  color?: string;
}) {
  const Icon = ICONS[name];
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Icon size={size} color={color} weight={focused ? "fill" : "regular"} />
      {/* classic, subtle underline as active indicator */}
      <View
        style={{
          marginTop: 4,
          width: 18,
          height: 2,
          borderRadius: 1,
          backgroundColor: focused ? color : "transparent",
          opacity: focused ? 0.9 : 0,
        }}
      />
    </View>
  );
}
