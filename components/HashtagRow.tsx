import React, { useCallback, useMemo, useRef, useState } from "react";
import {
    NativeSyntheticEvent,
    Text,
    TextInput,
    TextInputKeyPressEventData,
    TouchableOpacity,
    View
} from "react-native";

// Accessible, soft palette (light/dark friendly-ish). You can theme this later.
const CHIP_BG = ["#E3F2FD", "#E8F5E9", "#FFF8E1", "#F3E5F5", "#E0F2F1"];
const CHIP_TX = ["#0D47A1", "#1B5E20", "#9A6700", "#4A148C", "#004D40"];

type Props = {
  tags: string[];                       // stored WITHOUT '#'
  onChangeTags: (next: string[]) => void;
  maxTags?: number;                     // default 5
  maxLen?: number;                      // max per tag (default 24)
  testID?: string;
};

const isDelimiter = (ch: string) => ch === " " || ch === "," || ch === "\n";

const normalize = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")          // strip leading '#'
    .replace(/\s+/g, "_")        // internal spaces -> underscores
    .replace(/[^a-z0-9_]/g, ""); // allow a-z 0-9 _ only

const Chip = React.memo(function Chip({
  tag,
  colorIndex,
  onRemove,
}: {
  tag: string;
  colorIndex: number;
  onRemove: (t: string) => void;
}) {
  const bg = CHIP_BG[colorIndex % CHIP_BG.length];
  const tx = CHIP_TX[colorIndex % CHIP_TX.length];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        marginRight: 6,
        marginBottom: 6,
      }}
      accessibilityRole="button"
      accessibilityLabel={`Hashtag ${tag}. Double tap to remove.`}
    >
      <Text style={{ color: tx, fontWeight: "600" }}>#{tag}</Text>
      <TouchableOpacity
        onPress={() => onRemove(tag)}
        style={{ marginLeft: 8, paddingHorizontal: 4, paddingVertical: 2 }}
        accessibilityLabel={`Remove hashtag ${tag}`}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      >
        <Text style={{ color: tx, fontWeight: "800" }}>×</Text>
      </TouchableOpacity>
    </View>
  );
});

export default function HashtagField({
  tags,
  onChangeTags,
  maxTags = 5,
  maxLen = 24,
  testID,
}: Props) {
  const [input, setInput] = useState("");
  const backspaceArmed = useRef(false); // for backspace-to-remove on empty input

  const canAddMore = tags.length < maxTags;

  const addToken = useCallback(
    (token: string) => {
      if (!canAddMore) return;

      const clean = normalize(token);
      if (!clean) return;
      if (clean.length > maxLen) return;
      if (tags.includes(clean)) return;

      onChangeTags([...tags, clean]);
    },
    [canAddMore, maxLen, onChangeTags, tags],
  );

  // Split on delimiters; all full tokens become chips, last partial stays in input
  const handleChange = useCallback(
    (text: string) => {
      // Fast path: no delimiter -> just update input
      if (![..." ,\n"].some((d) => text.includes(d))) {
        setInput(text);
        return;
      }

      const parts = text.split(/[, \n]+/);
      // If text ends with a delimiter, the last part is "", else it's partial
      const lastIsPartial = text.length > 0 && !isDelimiter(text[text.length - 1]);
      const fullTokens = lastIsPartial ? parts.slice(0, -1) : parts;

      if (fullTokens.length) {
        // Add tokens in a single pass (respect limits)
        let next = tags.slice();
        for (const raw of fullTokens) {
          if (next.length >= maxTags) break;
          const clean = normalize(raw);
          if (clean && clean.length <= maxLen && !next.includes(clean)) {
            next.push(clean);
          }
        }
        if (next.length !== tags.length) onChangeTags(next);
      }
      setInput(lastIsPartial ? parts[parts.length - 1] : "");
      backspaceArmed.current = false;
    },
    [maxLen, maxTags, onChangeTags, tags],
  );

  const handleSubmit = useCallback(() => {
    if (!input) return;
    addToken(input);
    setInput("");
    backspaceArmed.current = false;
  }, [addToken, input]);

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = e.nativeEvent.key;
      // Create on delimiters for iOS; Android onKeyPress can be unreliable,
      // but handleChange already splits on delimiters as user types.
      if (key === " " || key === "Enter" || key === ",") {
        handleSubmit();
      } else if (key === "Backspace" && input.length === 0) {
        // two-step backspace: first arms, second removes last chip
        if (backspaceArmed.current && tags.length > 0) {
          const next = tags.slice(0, -1);
          onChangeTags(next);
          backspaceArmed.current = false;
        } else {
          backspaceArmed.current = true;
        }
      } else {
        backspaceArmed.current = false;
      }
    },
    [handleSubmit, input.length, onChangeTags, tags],
  );

  const removeTag = useCallback(
    (t: string) => onChangeTags(tags.filter((x) => x !== t)),
    [onChangeTags, tags],
  );

  const helperText = useMemo(() => {
    if (!canAddMore) return `Max ${maxTags} hashtags`;
    if (input.length > maxLen) return `Max ${maxLen} characters`;
    return undefined;
  }, [canAddMore, input.length, maxLen, maxTags]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        marginTop: 10,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 12,
        backgroundColor: "#fff",
        padding: 10,
      }}
      testID={testID}
    >
      {/* Left column: label */}
      <View style={{ width: 96, paddingTop: 4 }}>
        <Text
          style={{ fontWeight: "700", color: "#111827" }}
          accessibilityRole="text"
          accessibilityLabel="Hashtags label"
        >
          Hashtags
        </Text>
        <Text style={{ color: "#6b7280", marginTop: 2, fontSize: 12 }}>
          up to {maxTags}
        </Text>
      </View>

      {/* Right column: chips + inline input */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
          {tags.map((t, i) => (
            <Chip key={t} tag={t} colorIndex={i} onRemove={removeTag} />
          ))}
          <TextInput
            value={input}
            onChangeText={handleChange}
            onSubmitEditing={handleSubmit}
            onKeyPress={handleKeyPress}
            placeholder={tags.length ? "" : "weekend, meetup…"}
            placeholderTextColor="#9ca3af"
            accessibilityLabel="Add hashtags"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            style={{
              minWidth: 60,
              flexGrow: 1,
              paddingVertical: 6,
              paddingHorizontal: 4,
            }}
          />
        </View>
        {!!helperText && (
          <Text style={{ marginTop: 4, color: "#9ca3af", fontSize: 12 }}>{helperText}</Text>
        )}
      </View>
    </View>
  );
}
