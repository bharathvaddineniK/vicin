// app/(tabs)/_layout.tsx
import TabIcon from "@/components/TabIcon";
import { useSession } from "@/lib/session";
import { useTheme } from "@react-navigation/native";
import { router, Tabs } from "expo-router";
import { useEffect, useRef } from "react";
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
  
  // Store reference to draft protection function and pending navigation
  const draftProtectionRef = useRef<(() => boolean) | null>(null);
  const pendingNavigationRef = useRef<string | null>(null);
  
  // Global function to set draft protection
  (global as any).setDraftProtection = (checkFn: (() => boolean) | null) => {
    draftProtectionRef.current = checkFn;
  };

  // Global function to complete pending navigation
  (global as any).completePendingNavigation = () => {
    if (pendingNavigationRef.current) {
      const targetRoute = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      
      // Navigate to the intended tab
      setTimeout(() => {
        switch (targetRoute) {
          case "index":
            router.push("/(tabs)");
            break;
          case "maps":
            router.push("/(tabs)/maps");
            break;
          case "profile":
            router.push("/(tabs)/profile");
            break;
          case "settings":
            router.push("/(tabs)/settings");
            break;
          default:
            router.push("/(tabs)");
        }
      }, 100);
    }
  };

  // Helper function to handle tab press with draft protection
  const handleTabPress = (routeName: string, e: any) => {
    if (draftProtectionRef.current) {
      // Store the intended navigation target
      pendingNavigationRef.current = routeName;
      
      // Check if draft protection should prevent navigation
      if (draftProtectionRef.current()) {
        e.preventDefault();
        return;
      }
    }
    
    // Clear pending navigation if no protection needed
    pendingNavigationRef.current = null;
  };

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
        listeners={{
          tabPress: (e) => handleTabPress("index", e),
        }}
      />
      <Tabs.Screen
        name="maps"
        options={{
          title: "Map",
          tabBarIcon: ({ focused }) => <TabIcon name="map" focused={focused} />,
        }}
        listeners={{
          tabPress: (e) => handleTabPress("maps", e),
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
        listeners={{
          tabPress: (e) => handleTabPress("profile", e),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
        listeners={{
          tabPress: (e) => handleTabPress("settings", e),
        }}
      />
    </Tabs>
  );
}
