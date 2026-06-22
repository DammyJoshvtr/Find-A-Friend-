import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { StoryGroup } from "../../lib/stories";
import { useTheme } from "../../lib/theme";
import { useAuthStore } from "../../store/authStore";
import { useStoriesStore } from "../../store/storiesStore";
import StoryCircle from "../stories/StoryCircle";

export default function StoriesRow() {
  const { groups, loading, loadStories } = useStoriesStore();
  const { user } = useAuthStore();
  const theme = useTheme();

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const ownGroup = groups.find((g) => g.author_id === user?.id);
  const otherGroups = groups.filter((g) => g.author_id !== user?.id);

  const ownPlaceholder: StoryGroup = ownGroup ?? {
    author_id: user?.id ?? "own",
    author_name: "You",
    author_avatar: null,
    all_viewed: true,
    stories: [],
  };

  return (
    <View
      style={[
        s.wrapper,
        { borderBottomColor: theme.border, backgroundColor: theme.card },
      ]}
    >
      <View style={[StyleSheet.absoluteFill, s.tint]} pointerEvents="none" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        <StoryCircle
          group={ownPlaceholder}
          isOwn
          onAddStory={() => router.push("/create-story" as const)}
        />
        {otherGroups.map((group) => (
          <StoryCircle key={group.author_id} group={group} />
        ))}

        {/* Instant Refresh Stories button styled like a StoryCircle */}
        <TouchableOpacity
          style={s.refreshCircle}
          onPress={() => loadStories()}
          disabled={loading}
        >
          <View
            style={[
              s.ring,
              { borderColor: theme.border, backgroundColor: theme.card },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Ionicons name="refresh" size={22} color={theme.accent} />
            )}
          </View>
          <Text style={[s.label, { color: theme.textMuted }]}>Refresh</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    marginBottom: 6,
    overflow: "hidden",
  },
  content: { paddingHorizontal: 16, gap: 2 },
  tint: { backgroundColor: "rgba(167,139,250,0.04)" },
  refreshCircle: {
    alignItems: "center",
    width: 72,
    marginRight: 4,
  },
  ring: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    padding: 2,
    marginBottom: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 10,
    textAlign: "center",
    maxWidth: 68,
  },
});
