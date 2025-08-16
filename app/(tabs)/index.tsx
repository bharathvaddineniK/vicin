// /app/(tabs)/index.tsx
import { supabase } from "@/lib/supabase";
import { ResizeMode, Video } from "expo-av";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  Text,
  View,
} from "react-native";

type MediaRow = { url: string; kind: "image" | "video" };
type FeedPost = {
  id: string;
  content: string;
  post_type: string | null;
  created_at: string;
  expires_at: string | null;
  post_media: MediaRow[]; // ← joined rows
};

export default function HomeFeed() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, content, post_type, created_at, expires_at, post_media(url,kind)",
        )
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!mounted) return;
      if (!error && data) setPosts(data as unknown as FeedPost[]);
      setLoading(false);
    })();

    // live inserts (just posts; media may land moments later)
    const ch = supabase
      .channel("posts-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          setPosts((p) => [{ ...(payload.new as any), post_media: [] }, ...p]);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!posts.length) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: "#64748b" }}>No posts yet. Be the first!</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FlatList
        contentContainerStyle={{ padding: 12, gap: 10 }}
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const images =
            item.post_media?.filter((m) => m.kind === "image") ?? [];
          const video =
            item.post_media?.find((m) => m.kind === "video") ?? null;
          return (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 14,
                padding: 12,
                borderWidth: 1,
                borderColor: "#e5e7eb",
              }}
            >
              <Text style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                {(item.post_type ?? "update").toUpperCase()}
              </Text>
              <Text style={{ color: "#111827" }}>{item.content}</Text>

              {/* images */}
              {images.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {images.map((m, i) => (
                    <Image
                      key={m.url + i}
                      source={{ uri: m.url }}
                      style={{
                        width: 104,
                        height: 104,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "#e5e7eb",
                      }}
                    />
                  ))}
                </View>
              )}

              {/* video */}
              {video && (
                <View style={{ marginTop: 10 }}>
                  <Video
                    source={{ uri: video.url }}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                    style={{
                      width: "100%",
                      height: 200,
                      borderRadius: 12,
                      backgroundColor: "#000",
                    }}
                  />
                </View>
              )}

              <Text style={{ color: "#94a3b8", marginTop: 8, fontSize: 12 }}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
