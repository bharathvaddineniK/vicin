import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
export default function Login() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <Text>Login placeholder</Text>
      <Pressable onPress={() => router.replace("/(tabs)")}>
        <Text>Continue</Text>
      </Pressable>
    </View>
  );
}
