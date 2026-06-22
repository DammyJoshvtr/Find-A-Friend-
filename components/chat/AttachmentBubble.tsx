import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { typography } from "../../lib/typography";
import type { Attachment } from "../../lib/chatAttachments";
import { useVideoPlayer, VideoView } from "expo-video";

const SCREEN_W = Dimensions.get("window").width;

export function AttachmentBubble({
  attachment,
  onLongPress,
}: {
  attachment: Attachment;
  mine: boolean;
  onLongPress?: () => void;
}) {
  const handleOpen = () => Linking.openURL(attachment.url).catch(() => {});

  if (attachment._type as string === "image" || attachment._type as string === "sticker") {
    const imgW = Math.min(SCREEN_W * 0.65, 260);
    const aspectH =
      attachment.width && attachment.height
        ? imgW * (attachment.height / attachment.width)
        : imgW;
    return (
      <TouchableOpacity onPress={handleOpen} onLongPress={onLongPress} activeOpacity={0.85}>
        <Image
          source={{ uri: attachment.url }}
          style={{
            width: imgW,
            height: Math.min(aspectH, 320),
            borderRadius: 12,
          }}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ borderRadius: 14, overflow: 'hidden' }}>
      <InlineVideoPlayer
        sourceUrl={attachment.url}
        style={{ width: 220, height: 160, backgroundColor: 'black' }}
      />
    </View>
  );
}

const attb = StyleSheet.create({
  videoWrap: { width: 220, borderRadius: 14, padding: 12, gap: 10 },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  videoInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  videoLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontFamily: typography.fontRegular,
  },
});

function InlineVideoPlayer({ sourceUrl, style }: { sourceUrl: string; style: any }) {
  const player = useVideoPlayer(sourceUrl, (p) => {
    p.loop = false
  })
  return (
    <VideoView
      player={player}
      style={style}
      contentFit="contain"
      nativeControls={true}
    />
  )
}
