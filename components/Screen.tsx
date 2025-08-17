import React from "react";
import { Platform, StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = {
  children: React.ReactNode;
  // Optional override if a screen needs a different bg (e.g., pure white)
  backgroundColor?: string;
  // "dark-content" on light bg (default) or "light-content" on dark bg
  barStyle?: "dark-content" | "light-content";
  // Whether to include bottom safe edge (if you have a fixed tab bar, keep bottom true)
  edges?: ("top" | "bottom")[];
};

export default function Screen({
  children,
  backgroundColor = "#f8fafc",
  barStyle = "dark-content",
  edges = ["top", "bottom"],
}: ScreenProps) {
  // On Android we keep a non-translucent status bar with bg color so content never collides.
  const isAndroid = Platform.OS === "android";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={edges}>
      <StatusBar
        translucent={false}
        backgroundColor={isAndroid ? backgroundColor : undefined}
        barStyle={barStyle}
      />
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}
