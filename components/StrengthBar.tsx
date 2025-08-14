import { Text, View } from "react-native";

export default function StrengthBar({
  score,
  color,
  label,
}: {
  score: 0 | 1 | 2 | 3 | 4;
  color: string;
  label: string;
}) {
  const cells = [0, 1, 2, 3];

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {cells.map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 6,
              backgroundColor: i < score ? color : "#e5e7eb",
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 12, color: "#64748b" }}>{label}</Text>
    </View>
  );
}
