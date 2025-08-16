// app/(tabs)/_layout.tsx
import { useSession } from "@/lib/session";
import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { BackHandler, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// simple label component
function L({ children }: { children: string }) {
  return <Text style={{ fontSize: 11, fontWeight: "600" }}>{children}</Text>;
}

export default function TabsLayout() {
  const inset = useSafeAreaInsets();
  const { session, isGuest } = useSession();
  const router = useRouter();

  // Disable Android hardware back while inside tabs (prevents going back to auth)
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 60 + inset.bottom,
          paddingBottom: inset.bottom ? inset.bottom - 4 : 8,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          backgroundColor: "#fff",
        },
        tabBarActiveTintColor: "#111827",
        tabBarInactiveTintColor: "#6b7280",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🏠</Text>,
          tabBarLabel: ({ color }) => (
            <Text style={{ color }}>
              <L>Home</L>
            </Text>
          ),
        }}
      />

      <Tabs.Screen
        name="maps"
        options={{
          title: "Map",
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🗺️</Text>,
          tabBarLabel: ({ color }) => (
            <Text style={{ color }}>
              <L>Map</L>
            </Text>
          ),
        }}
      />

      <Tabs.Screen
        name="post"
        // Optional: intercept tab press. We still navigate to (tabs)/post,
        // which renders only the gate modal for guests (no form flicker).
        listeners={{
          tabPress: (e) => {
            if (isGuest || !session) {
              // If you prefer to stay on the current tab and open auth directly:
              // e.preventDefault();
              // router.replace("/(auth)/signup");
              // Otherwise do nothing; navigating to (tabs)/post shows the modal-only screen.
            }
          },
        }}
        options={{
          title: "Post",
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>➕</Text>,
          tabBarLabel: ({ color }) => (
            <Text style={{ color }}>
              <L>Post</L>
            </Text>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>👤</Text>,
          tabBarLabel: ({ color }) => (
            <Text style={{ color }}>
              <L>Profile</L>
            </Text>
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>⚙️</Text>,
          tabBarLabel: ({ color }) => (
            <Text style={{ color }}>
              <L>Settings</L>
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
