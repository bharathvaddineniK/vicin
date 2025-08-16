import {
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  onCancel: () => void; // dismiss/snooze
  onChooseMap: () => void; // fallback: manual area
  onAllow: () => void; // triggers OS permission request
  onEnable: () => void | Promise<void>;
};

// Optional: point to your logo (already in assets) and a tasteful map-y illustration.
// Replace these requires if your assets live elsewhere.
const logo = require("../assets/logo.png"); // use your brand mark
// If you don’t have a map image yet, keep this null and we’ll render a colored header.
const mapImg: any = null;

export default function LocationPermissionModal({
  visible,
  onCancel,
  onChooseMap,
  onAllow,
  onEnable,
}: Props) {
  const isIOS = Platform.OS === "ios";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: isIOS ? "#F8FAFC" : "#111827",
            borderWidth: isIOS ? 1 : 0,
            borderColor: isIOS ? "#E5E7EB" : "transparent",
          }}
          accessibilityViewIsModal
          accessible
        >
          {/* Brand header with map illustration */}
          {mapImg ? (
            <ImageBackground
              source={mapImg}
              resizeMode="cover"
              style={{ height: 120, backgroundColor: "#DCF2FF" }}
            >
              <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }} />
            </ImageBackground>
          ) : (
            <View
              style={{
                height: 110,
                backgroundColor: "#E6F0FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                source={logo}
                style={{ width: 56, height: 56, borderRadius: 12 }}
              />
            </View>
          )}

          {/* Body */}
          <View style={{ paddingVertical: 16, paddingHorizontal: 18 }}>
            <Text
              style={{
                fontWeight: "800",
                fontSize: 18,
                color: isIOS ? "#0F172A" : "#F8FAFC",
                textAlign: "center",
                marginBottom: 6,
              }}
              accessibilityRole="header"
            >
              {isIOS
                ? "Allow “Vicin” to use your location?"
                : "Allow Vicin to access this device’s location?"}
            </Text>

            <Text
              style={{
                color: isIOS ? "#4B5563" : "#D1D5DB",
                textAlign: "center",
                marginBottom: 14,
              }}
            >
              We use your location to show nearby posts and alerts. You can
              change this anytime.
            </Text>

            {/* iOS‑style action list vs Android buttons */}
            {isIOS ? (
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={onAllow}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: "#2563EB",
                  })}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 16,
                      textAlign: "center",
                      fontWeight: "700",
                    }}
                  >
                    Allow While Using App
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onChooseMap}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#93C5FD",
                    backgroundColor: "#fff",
                  })}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: "#1E40AF",
                      fontSize: 16,
                      textAlign: "center",
                      fontWeight: "700",
                    }}
                  >
                    Choose Area on Map
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onCancel}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.6 : 1,
                    paddingVertical: 10,
                  })}
                >
                  <Text style={{ color: "#2563EB", textAlign: "center" }}>
                    Maybe later
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={onAllow}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: "#2563EB",
                  })}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 16,
                      textAlign: "center",
                      fontWeight: "700",
                    }}
                  >
                    While using the app
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onChooseMap}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#9CA3AF",
                    backgroundColor: "#0B1220",
                  })}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: "#E5E7EB",
                      fontSize: 16,
                      textAlign: "center",
                      fontWeight: "700",
                    }}
                  >
                    Choose area on map
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onCancel}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.6 : 1,
                    paddingVertical: 10,
                  })}
                >
                  <Text style={{ color: "#A7B0BF", textAlign: "center" }}>
                    Maybe later
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
