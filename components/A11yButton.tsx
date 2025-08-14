import { theme } from "@/lib/theme";
import { Pressable, Text } from "react-native";

type Props = {
  onPress?: () => void;
  children: string;
  disabled?: boolean;
  testID?: string;
  role?: "button" | "link";
};

export default function A11yButton({
  onPress,
  children,
  disabled,
  testID,
  role = "button",
}: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      testID={testID}
      accessibilityRole={role}
      accessibilityState={{ disabled: !!disabled }}
      accessible
      hitSlop={10}
      style={({ pressed }) => ({
        backgroundColor: disabled
          ? "#93C5FD"
          : pressed
            ? theme.colors.primaryHover
            : theme.colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: theme.radii.md,
        minHeight: theme.touch,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: "#FFF",
          fontSize: theme.type.md,
          fontWeight: "700",
          letterSpacing: 0.3,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
