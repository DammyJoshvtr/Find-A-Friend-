/**
 * components/stories/StoryViewer.tsx
 * Full-screen story viewer with progress bars, tap navigation, and auto-advance.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Linking,
} from "react-native";
import Toast from "react-native-toast-message";
import { getInitials, getTimeAgo } from "../../lib/matching";
import { deleteStory } from "../../lib/stories";
import { client } from "../../lib/aws";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import {
  selectCurrentGroup,
  selectCurrentStory,
  useStoriesStore,
} from "../../store/storiesStore";
import { supportsVideoStories } from "../../lib/featureFlags";
import { router } from "expo-router";

let VideoPlayer: any = null;
try {
  if (supportsVideoStories()) {
    VideoPlayer = require("./VideoPlayer").default;
  }
} catch (e) {
  console.warn("Failed to load VideoPlayer component dynamically:", e);
}

const STORY_EMOJIS = ["❤️", "😂", "😮", "🔥", "👏"];

const { width: SCREEN_W } = Dimensions.get("window");

export default function StoryViewer() {
  const {
    viewerGroupId,
    viewerIndex,
    closeViewer,
    advanceViewer,
    markViewed,
    loadStories,
    groups,
  } = useStoriesStore();

  const visible = !!viewerGroupId;
  const { user } = useAuthStore();
  const story = useStoriesStore(selectCurrentStory);
  const group = useStoriesStore(selectCurrentGroup);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentProgress = useRef(0);
  const [paused, setPaused] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => {
      currentProgress.current = value;
    });
    return () => progressAnim.removeListener(id);
  }, [progressAnim]);

  // Reset loading state and handle media load fallback when the story changes
  useEffect(() => {
    if (story?.id) {
      setIsHolding(false);
      setIsVideoPlaying(false);
      progressAnim.setValue(0);
      currentProgress.current = 0;
      setStoryComment("");
      setVideoDuration(null);

      if (visible) {
        markViewed(story.id);
      }

      if (story.media_type === "video" && !supportsVideoStories()) {
        setMediaLoaded(true);
      } else {
        setMediaLoaded(false);
      }
    }
  }, [story?.id, visible]);

  // Reactions + comments
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [storyComment, setStoryComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

  // Stable next handler — must be defined before startProgress
  const handleNext = useCallback(() => {
    progressRef.current?.stop();
    advanceViewer();
  }, [advanceViewer]);

  const startProgress = useCallback(
    (resume = false) => {
      progressRef.current?.stop();
      if (!resume) {
        progressAnim.setValue(0);
        currentProgress.current = 0;
      }
      const duration = videoDuration
        ? videoDuration * 1000
        : Math.max(1000, (story?.duration_secs ?? 5) * 1000);
      const remainingDuration = resume
        ? duration * (1 - currentProgress.current)
        : duration;

      progressRef.current = Animated.timing(progressAnim, {
        toValue: 1,
        duration: remainingDuration,
        useNativeDriver: false,
      });
      progressRef.current.start(({ finished }) => {
        if (finished) handleNext();
      });
    },
    [story, progressAnim, handleNext, videoDuration],
  );

  const handleUpdateApp = () => {
    closeViewer();
    router.push("/settings" as any);
  };

  const handleGoBack = () => {
    closeViewer();
  };

  useEffect(() => {
    if (visible && story && mediaLoaded) {
      const isVideo = story.media_type === "video";
      const shouldPause = paused || (isVideo && !isVideoPlaying);
      if (shouldPause) {
        progressRef.current?.stop();
      } else {
        const isNewStory = currentProgress.current === 0;
        startProgress(!isNewStory);
      }
    }
    return () => {
      progressRef.current?.stop();
    };
  }, [visible, story?.id, mediaLoaded, paused, isVideoPlaying, story?.media_type, startProgress]);

  // Load current user's reaction when story changes
  useEffect(() => {
    if (!story?.id || !user?.id) {
      setMyReaction(null);
      return;
    }
    supabase
      .from("story_reactions")
      .select("emoji")
      .eq("story_id", story.id)
      .eq("user_id", user.id)
      .then(({ data, error }: any) => {
        if (!error && data) {
          setMyReaction(data[0]?.emoji ?? null);
        }
      });
    setStoryComment("");
  }, [story?.id, user?.id]);

  const handleReaction = async (emoji: string) => {
    if (!story?.id || !user?.id) return;
    const isSame = myReaction === emoji;
    setMyReaction(isSame ? null : emoji);
    if (isSame) {
      await supabase
        .from("story_reactions")
        .delete()
        .eq("story_id", story.id)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("story_reactions")
        .upsert({ user_id: user.id, story_id: story.id, emoji });
      // Mirror to author's DM so they see it in chat
      if (story.author_id !== user.id) {
        // TODO: Complex RPC
        const convId = null as any;
        if (convId) {
          await supabase
            .from("messages")
            .insert({
              conversation_id: convId,
              sender_id: user.id,
              body: JSON.stringify({
                _type: "story_reaction",
                emoji,
                storyId: story.id,
                caption: story.caption ?? "",
                mediaUrl: story.media_url,
              }),
            });
        }
      }
    }
  };

  const handleSendStoryComment = async () => {
    const text = storyComment.trim();
    if (!text || !story?.id || !user?.id) return;
    setSendingComment(true);

    // Mirror to author's DM regardless of story_comments table availability
    if (story.author_id !== user.id) {
      // TODO: Complex RPC
      const convId = null as any;
      if (convId) {
        await supabase
          .from("messages")
          .insert({
            conversation_id: convId,
            sender_id: user.id,
            body: JSON.stringify({
              _type: "story_comment",
              body: text,
              storyId: story.id,
              caption: story.caption ?? "",
              mediaUrl: story.media_url,
            }),
          });
      }
    }

    // Also insert into story_comments if the table exists (best-effort)
    await supabase
      .from("story_comments")
      .insert({
        story_id: story.id,
        author_id: user.id,
        body: text,
      });

    setStoryComment("");
    commentInputRef.current?.blur();
    Toast.show({ type: "success", text1: "Comment sent!" });
    setSendingComment(false);
  };

  const handlePrev = () => {
    progressRef.current?.stop();
    const groupIdx = groups.findIndex((g) => g.author_id === viewerGroupId);
    if (groupIdx === -1) return;
    if (viewerIndex > 0) {
      useStoriesStore.setState({ viewerIndex: viewerIndex - 1 });
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1];
      useStoriesStore.setState({
        viewerGroupId: prevGroup.author_id,
        viewerIndex: prevGroup.stories.length - 1,
      });
    }
  };

  const handleDelete = () => {
    if (!story) return;
    Alert.alert("Delete story", "Remove this story for everyone?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await deleteStory(story.id);
          if (error) {
            Alert.alert("Error", error.message);
            return;
          }
          closeViewer();
          await loadStories();
        },
      },
    ]);
  };

  if (!visible || !story || !group) return null;

  const storiesInGroup = group.stories.length;
  const isOwnStory = story.author_id === user?.id;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <StatusBar hidden />
      <View style={s.container}>
        {/* Story media */}
        {story.media_type === "video" ? (
          supportsVideoStories() && VideoPlayer ? (
            <View style={{ flex: 1, width: "100%", opacity: mediaLoaded ? 1 : 0 }}>
              <VideoPlayer
                sourceUrl={story.media_url}
                paused={paused}
                onLoad={(dur: number) => {
                  if (dur) setVideoDuration(dur);
                  setMediaLoaded(true);
                }}
                onPlayingStateChange={(playing: boolean) => setIsVideoPlaying(playing)}
              />
            </View>
          ) : (
            <View style={s.fallbackContainer}>
              <Ionicons
                name="videocam-off-outline"
                size={64}
                color="#ef4444"
                style={{ marginBottom: 16 }}
              />
              <Text style={s.fallbackTitle}>New Update Available</Text>
              <Text style={s.fallbackMessage}>
                To view this video story, please update your app. Visit our website: fafcampus.site
              </Text>
              <View style={s.fallbackBtnRow}>
                <TouchableOpacity
                  style={s.fallbackUpdateBtn}
                  onPress={() => Linking.openURL("https://fafcampus.site")}
                >
                  <Text style={s.fallbackUpdateText}>Visit Website</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.fallbackBackBtn}
                  onPress={handleGoBack}
                >
                  <Text style={s.fallbackBackText}>Go Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        ) : (
          <Image
            source={{ uri: story.media_url }}
            style={[s.media, { opacity: mediaLoaded ? 1 : 0 }]}
            resizeMode="cover"
            onLoadStart={() => setMediaLoaded(false)}
            onLoad={() => setMediaLoaded(true)}
          />
        )}

        {!mediaLoaded && (story.media_type !== "video" || supportsVideoStories()) && (
          <View style={[StyleSheet.absoluteFill, s.loadingOverlay]}>
            <ActivityIndicator
              size="large"
              color="#fff"
              style={{ transform: [{ scale: 1.5 }] }}
            />
          </View>
        )}

        {/* Dark gradient overlay */}
        <View style={[s.topGradient, isHolding && { opacity: 0 }]} />
        <View style={[s.bottomGradient, isHolding && { opacity: 0 }]} />

        {/* Tap zones — rendered before header so header sits on top and receives touches */}
        <View style={s.tapZones}>
          <TouchableWithoutFeedback
            onPressIn={() => {
              setPaused(true);
              setIsHolding(true);
            }}
            onPressOut={() => {
              setPaused(false);
              setIsHolding(false);
            }}
            onLongPress={() => {}}
            onPress={handlePrev}
          >
            <View style={s.tapLeft} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback
            onPressIn={() => {
              setPaused(true);
              setIsHolding(true);
            }}
            onPressOut={() => {
              setPaused(false);
              setIsHolding(false);
            }}
            onLongPress={() => {}}
            onPress={handleNext}
          >
            <View style={s.tapRight} />
          </TouchableWithoutFeedback>
        </View>

        {/* Progress bars */}
        <View style={[s.progressBars, isHolding && { opacity: 0 }]}>
          {Array.from({ length: storiesInGroup }).map((_, i) => (
            <View key={i} style={s.progressTrack}>
              <Animated.View
                style={[
                  s.progressFill,
                  {
                    width:
                      i < viewerIndex
                        ? "100%"
                        : i === viewerIndex
                          ? progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0%", "100%"],
                            })
                          : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header — rendered after tap zones so it receives touches first */}
        <View style={[s.header, isHolding && { opacity: 0 }]}>
          <View style={s.authorRow}>
            <View style={s.authorAvatar}>
              {group.author_avatar ? (
                <Image
                  source={{ uri: group.author_avatar }}
                  style={s.authorAvatarImg}
                />
              ) : (
                <Text style={s.authorInitials}>
                  {getInitials(group.author_name ?? "?")}
                </Text>
              )}
            </View>
            <View>
              <Text style={s.authorName}>{group.author_name ?? "User"}</Text>
              <Text style={s.storyTime}>{getTimeAgo(story.created_at)}</Text>
            </View>
          </View>

          <View style={s.headerActions}>
            {isOwnStory && (
              <TouchableOpacity onPress={handleDelete} style={s.actionBtn}>
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color="rgba(255,80,80,0.9)"
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={closeViewer} style={s.actionBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Caption */}
        {story.caption ? (
          <View style={[s.captionWrap, isHolding && { opacity: 0 }]}>
            <Text style={s.caption}>{story.caption}</Text>
          </View>
        ) : null}

        {/* Bottom interaction bar: emoji reactions + comment input */}
        <View style={[s.interactionBar, isHolding && { opacity: 0 }]}>
          <View style={s.emojiRow}>
            {STORY_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => handleReaction(emoji)}
                style={[s.emojiBtn, myReaction === emoji && s.emojiBtnActive]}
              >
                <Text style={s.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.storyCommentRow}>
            <TextInput
              ref={commentInputRef}
              style={s.storyCommentInput}
              placeholder="Send a comment..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={storyComment}
              onChangeText={setStoryComment}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              returnKeyType="send"
              onSubmitEditing={handleSendStoryComment}
            />
            {storyComment.trim() ? (
              <TouchableOpacity
                onPress={handleSendStoryComment}
                style={s.storyCommentSendBtn}
              >
                {sendingComment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  loadingOverlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  media: {
    flex: 1,
    width: "100%",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: "transparent",
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  progressBars: {
    position: "absolute",
    top: 50,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
  },
  header: {
    position: "absolute",
    top: 62,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2a1e40",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  authorAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  authorInitials: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  authorName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  storyTime: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  captionWrap: {
    position: "absolute",
    bottom: 140,
    left: 20,
    right: 20,
  },
  caption: {
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tapZones: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 120, // leave room for interaction bar
    flexDirection: "row",
  },
  tapLeft: { flex: 1 },
  tapRight: { flex: 1 },
  interactionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 28,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    gap: 10,
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  emojiBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  emojiBtnActive: {
    backgroundColor: "rgba(255,255,255,0.28)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.7)",
  },
  emojiText: { fontSize: 22 },
  storyCommentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  storyCommentInput: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 14,
    fontSize: 13,
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  storyCommentSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "#0a0a1a",
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  fallbackMessage: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  fallbackBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "center",
  },
  fallbackUpdateBtn: {
    backgroundColor: "#a78bfa",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  fallbackUpdateText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  fallbackBackBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  fallbackBackText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
