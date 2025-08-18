import { BellSimple, MagnifyingGlass, UserCircle } from "phosphor-react-native";
import React from "react";
import { Image, Pressable, Text, View } from "react-native";

type Props = {
  title?: string;
  onPressSearch?: () => void;
  onPressNotifications?: () => void;
  onPressProfile?: () => void;
  /** Optional profile avatar URL; if present we show it instead of the icon */
  profileUri?: string | null;
};

export default function Header({
  title = "Vicin",
  onPressSearch,
  onPressNotifications,
  onPressProfile,
  profileUri,
}: Props) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingBottom: 8,
        paddingTop: 4,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#f8fafc",
      }}
      accessibilityRole="header"
    >
      <Text style={{ fontSize: 22, fontWeight: "800", color: "#0f172a" }}>
        {title}
      </Text>

      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Pressable
          onPress={onPressSearch}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Search"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <MagnifyingGlass size={24} weight="regular" color="#0f172a" />
        </Pressable>

        <Pressable
          onPress={onPressNotifications}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <BellSimple size={24} weight="regular" color="#0f172a" />
        </Pressable>

        <Pressable
          onPress={onPressProfile}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          {profileUri ? (
            <Image
              source={{ uri: profileUri }}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: "#e5e7eb",
              }}
            />
          ) : (
            <UserCircle size={26} weight="regular" color="#0f172a" />
          )}
        </Pressable>
      </View>
    </View>
  );
}
