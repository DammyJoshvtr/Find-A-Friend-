import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme";
import { typography } from "../../lib/typography";

export function StoryInteractionBubble({
  interaction,
  mine,
}: {
  interaction: {
    _type: string;
    emoji?: string;
    body?: string;
    caption: string;
    mediaUrl: string;
  };
  mine: boolean;
}) {
  const theme = useTheme();
  const isReaction = interaction._type === "story_reaction";

  return (
    <View
      style={[
        sib.card,
        {
          backgroundColor: mine
            ? "rgba(167,139,250,0.15)"
            : "rgba(255,255,255,0.06)",
          borderColor: mine
            ? "rgba(167,139,250,0.35)"
            : "rgba(255,255,255,0.1)",
        },
      ]}
    >
      {/* Story thumbnail strip */}
      {interaction.mediaUrl ? (
        <Image
          source={{ uri: interaction.mediaUrl }}
          style={sib.thumb}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            sib.thumbPlaceholder,
            { backgroundColor: "rgba(167,139,250,0.1)" },
          ]}
        >
          <Ionicons
            name="image-outline"
            size={18}
            color="rgba(167,139,250,0.5)"
          />
        </View>
      )}

      <View style={sib.info}>
        <Text style={sib.tag}>
          {isReaction ? "Reacted to your story" : "Commented on your story"}
        </Text>
        {!!interaction.caption && (
          <Text
            style={[sib.caption, { color: theme.textFaint }]}
            numberOfLines={1}
          >
            {interaction.caption}
          </Text>
        )}
        {isReaction ? (
          <Text style={sib.reactionEmoji}>{interaction.emoji}</Text>
        ) : (
          <Text
            style={[sib.commentBody, { color: theme.text }]}
            numberOfLines={3}
          >
            "{interaction.body}"
          </Text>
        )}
      </View>
    </View>
  );
}

const sib = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    maxWidth: 270,
    minWidth: 190,
  },
  thumb: { width: 64, height: 86 },
  thumbPlaceholder: {
    width: 64,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, padding: 10, justifyContent: "center", gap: 4 },
  tag: {
    fontSize: 9,
    fontFamily: typography.fontSemiBold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "rgba(167,139,250,0.8)",
  },
  caption: { fontSize: 10, fontFamily: typography.fontRegular },
  reactionEmoji: { fontSize: 28, marginTop: 2 },
  commentBody: {
    fontSize: 12,
    fontFamily: typography.fontRegular,
    fontStyle: "italic",
    lineHeight: 17,
  },
});
