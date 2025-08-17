// app/(tabs)/_layout.tsx
import TabIcon from "@/components/TabIcon";
import { useSession } from "@/lib/session";
import { useTheme } from "@react-navigation/native";
import { router, Tabs } from "expo-router";
import { useEffect } from "react";
import { BackHandler, Platform, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// simple label component
function L({ children }: { children: string }) {
  return <Text style={{ fontSize: 11, fontWeight: "600" }}>{children}</Text>;
}


export default function TabsLayout() {

  const { isGuest, session, loading } = useSession();
  const insets = useSafeAreaInsets();
  const { colors, dark } = useTheme();
  const bg = colors.card; // follows navigator theme
  const hairline = colors.border ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)");
  const active = colors.text;
  const inactive = dark ? "rgba(148,163,184,1)" : "rgba(107,114,128,1)";

  // Disable Android hardware back while inside tabs (prevents going back to auth)
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          height: Platform.OS === "ios" ? 50 + insets.bottom : 50 + insets.bottom,
          paddingBottom: Platform.OS === "ios" ? insets.bottom : Math.max(insets.bottom, 8),
          backgroundColor: bg,
          borderTopWidth: 0.5,
          borderTopColor: hairline,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: { paddingVertical: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="maps"
        options={{
          title: "Map",
          tabBarIcon: ({ focused }) => <TabIcon name="map" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="post"
        options={{ title: "Post",
          tabBarIcon: ({ focused }) => <TabIcon name="post" focused={focused} />,
         }}
        listeners={{
          tabPress: (e) => {
            if (!loading && (isGuest || !session)) {
              e.preventDefault();
              // Send guests to a lightweight gate screen; Post screen never mounts
              router.push("/gate");
            }
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
