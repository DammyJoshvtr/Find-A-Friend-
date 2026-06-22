import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import {
  AttachmentSheet,
  type AttachmentOptionKey,
} from "../../components/AttachmentSheet";
import {
  parseReply,
  QuotedBubble,
  ReplyBanner,
  ReplyPayload,
} from "../../components/chat/ReplyUI";
import { StickerPicker } from "../../components/StickerPicker";
import {
  parseAttachment,
  pickMedia,
  recordVideo,
  takePhoto,
  type Attachment,
} from "../../lib/chatAttachments";
import { GAME_META, type GameType } from "../../lib/games";
import { getInitials } from "../../lib/matching";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { typography } from "../../lib/typography";
import { usePresenceStore } from "../../store/presenceStore";
import { useStickerStore } from "../../store/stickerStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseChallenge(
  body: string,
): {
  _type: "game_challenge";
  gameType: string;
  emoji: string;
  label: string;
} | null {
  try {
    const obj = JSON.parse(body);
    if (obj?._type === "game_challenge") return obj;
    return null;
  } catch {
    return null;
  }
}

function parseAcceptance(
  body: string,
): {
  _type: "challenge_accepted";
  gameType: string;
  emoji: string;
  label: string;
  sessionId?: string;
} | null {
  try {
    const obj = JSON.parse(body);
    if (obj?._type === "challenge_accepted") return obj;
    return null;
  } catch {
    return null;
  }
}

function parseStoryInteraction(body: string): {
  _type: "story_reaction" | "story_comment";
  emoji?: string;
  body?: string;
  storyId: string;
  caption: string;
  mediaUrl: string;
} | null {
  try {
    const obj = JSON.parse(body);
    if (obj?._type === "story_reaction" || obj?._type === "story_comment")
      return obj;
    return null;
  } catch {
    return null;
  }
}

/**
 * Format a message timestamp in WhatsApp style:
 *   - Today   → "14:32"
 *   - Yesterday → "Yesterday 14:32"
 *   - Older   → "12/05 14:32"
 */
function formatMsgTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();

  const pad = (n: number) => String(n).padStart(2, "0");
  const hhmm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return hhmm;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isYesterday) return `Yesterday ${hhmm}`;

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${hhmm}`;
}

/**
 * Return a day-separator label for a given ISO date string:
 *   "Today", "Yesterday", or "Mon, 12 May"
 */
function getDayLabel(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function isSameDay(a: string, b: string): boolean {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

import { ChallengeBubble } from "../../components/chat/ChallengeBubble";
import { AcceptanceBubble } from "../../components/chat/AcceptanceBubble";
import { StoryInteractionBubble } from "../../components/chat/StoryInteractionBubble";
import { AttachmentBubble } from "../../components/chat/AttachmentBubble";
import { MessageActionsModal } from "../../components/chat/MessageActionsModal";

// ─── Animated online pulse dot (WhatsApp green) ───────────────────────────────

function PulseDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 800 }),
        withTiming(0.9, { duration: 800 }),
      ),
      -1,
      true,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 11,
          height: 11,
          borderRadius: 6,
          // WhatsApp green is used exclusively for the online presence dot
          backgroundColor: "#25D366",
          borderWidth: 2,
          borderColor: "transparent",
        },
        style,
      ]}
    />
  );
}

// ─── Purple scan-line glow (online presence indicator at header top) ──────────

function ScanLine({ isOnline }: { isOnline: boolean }) {
  const lineOpacity = useSharedValue(isOnline ? 0.7 : 0.15);
  const shadowOp = useSharedValue(isOnline ? 0.6 : 0.05);

  useEffect(() => {
    if (isOnline) {
      lineOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
      shadowOp.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.2, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      lineOpacity.value = withTiming(0.15, { duration: 400 });
      shadowOp.value = withTiming(0.05, { duration: 400 });
    }
  }, [isOnline]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
    shadowOpacity: shadowOp.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: "#a78bfa",
          shadowColor: "#a78bfa",
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 8,
          elevation: 0,
        },
        animStyle,
      ]}
    />
  );
}

// ─── Day separator ────────────────────────────────────────────────────────────

function DaySeparator({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={ds.wrap}>
      <View style={[ds.line, { backgroundColor: theme.border }]} />
      <View
        style={[
          ds.pill,
          { backgroundColor: theme.card2, borderColor: theme.border },
        ]}
      >
        <Text style={[ds.label, { color: theme.textFaint }]}>{label}</Text>
      </View>
      <View style={[ds.line, { backgroundColor: theme.border }]} />
    </View>
  );
}

const ds = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
    gap: 8,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  label: { fontSize: 11, fontFamily: typography.fontMedium },
});

// ─── Empty state with pulse ───────────────────────────────────────────────────

function EmptyState({ name }: { name: string }) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={es.wrap}>
      <Animated.View style={animStyle}>
        <Text style={es.emoji}>👋</Text>
      </Animated.View>
      <Text style={[es.text, { color: theme.textMuted }]}>
        Say hello to {name}!
      </Text>
    </View>
  );
}

const es = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 80, gap: 10 },
  emoji: { fontSize: 52 },
  text: { fontSize: 14, fontFamily: typography.fontRegular },
});

// ─── Chat background dot pattern ─────────────────────────────────────────────
// Renders a subtle repeating dot grid behind the message list, mimicking
// WhatsApp's textured chat background without any exotic packages.

function ChatBackground() {
  const { width, height } = Dimensions.get("window");
  const DOT_SPACING = 22;
  const DOT_RADIUS = 1.2;
  const cols = Math.ceil(width / DOT_SPACING) + 1;
  const rows = Math.ceil(height / DOT_SPACING) + 1;

  const dots: { key: string; x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push({ key: `${r}-${c}`, x: c * DOT_SPACING, y: r * DOT_SPACING });
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d) => (
        <View
          key={d.key}
          style={{
            position: "absolute",
            left: d.x,
            top: d.y,
            width: DOT_RADIUS * 2,
            height: DOT_RADIUS * 2,
            borderRadius: DOT_RADIUS,
            backgroundColor: "rgba(167,139,250,0.06)",
          }}
        />
      ))}
    </View>
  );
}

// ─── Tick status indicator (sent / delivered / read) ─────────────────────────
// Single grey tick  = optimistic (sending)
// Double grey ticks = delivered (confirmed in DB, not yet read)
// Double blue ticks = read

function TickStatus({
  optimistic,
  isRead,
}: {
  optimistic: boolean;
  isRead: boolean;
}) {
  if (optimistic) {
    return (
      <Text
        style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", lineHeight: 13 }}
      >
        ✓
      </Text>
    );
  }
  if (isRead) {
    return (
      <Text style={{ fontSize: 9, color: "#60a5fa", lineHeight: 13 }}>✓✓</Text>
    );
  }
  return (
    <Text
      style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", lineHeight: 13 }}
    >
      ✓✓
    </Text>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DirectMessageScreen() {
  const { id: otherUserId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [myId, setMyId] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [otherProfile, setOtherProfile] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<any>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const { addSticker } = useStickerStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyPayload["replyTo"] | null>(
    null,
  );
  const [reactions, setReactions] = useState<Record<string, string[]>>({})
  const [chatStreak, setChatStreak] = useState({ streak_count: 0, at_risk: false, increased: false })
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const theme = useTheme();

  // ── Init ────────────────────────────────────────────────────────────────────

  const initConversation = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !otherUserId) {
        setLoading(false);
        return;
      }
      setMyId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", otherUserId)
        .single();
      setOtherProfile(profile);

      const { data: cid, error: rpcError } = await supabase.rpc(
        "get_or_create_conversation",
        {
          p_other_user_id: otherUserId,
        },
      );
      if (rpcError || !cid) {
        Toast.show({
          type: "error",
          text1: "Could not start chat",
          text2: rpcError?.message,
        });
        setLoading(false);
        return;
      }
      setConvId(cid);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*, profiles!sender_id(id, full_name, avatar_url)")
        .eq("conversation_id", cid)
        .order("created_at", { ascending: true });
      setMessages(msgs ?? []);
      setLoading(false);
      setTimeout(
        () => scrollRef.current?.scrollToEnd({ animated: false }),
        100,
      );

      // Mark all unread messages from the other person as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", cid)
        .neq("sender_id", user.id)
        .eq("is_read", false);

      // Load existing chat streak
      if (otherUserId) {
        const { data: streakData } = await supabase.rpc('get_chat_streak', {
          other_user_id: otherUserId,
        })
        if (streakData) {
          setChatStreak({
            streak_count: streakData.streak_count ?? 0,
            at_risk: streakData.at_risk ?? false,
            increased: false,
          })
        }
      }
    } catch (err) {
      console.error("Init error:", err);
      setLoading(false);
    }
  }, [otherUserId]);

  useEffect(() => {
    initConversation();
  }, [initConversation]);

  // ── Realtime subscriptions fallback (HTTP Polling) ─────────────────────────

  useEffect(() => {
    if (!convId) return;

    const syncMessages = async () => {
      try {
        const { data: msgs, error } = await supabase
          .from("messages")
          .select("*, profiles!sender_id(id, full_name, avatar_url)")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (msgs) {
          setMessages((prev) => {
            // Check if there are any differences in the list to avoid redrawing/re-scrolling
            const prevSignature = prev.map((m) => `${m.id}-${m.is_read}-${m.body}`).join(',');
            const newSignature = msgs.map((m) => `${m.id}-${m.is_read || m.sender_id !== myId}-${m.body}`).join(',');
            if (prevSignature === newSignature) return prev;

            // Mark any unread messages from the other person as read in the DB
            const unreadOtherIds = msgs
              .filter((m) => m.sender_id !== myId && !m.is_read)
              .map((m) => m.id);

            if (unreadOtherIds.length > 0) {
              supabase
                .from("messages")
                .update({ is_read: true })
                .in("id", unreadOtherIds)
                .then(() => {});
            }

            const mapped = msgs.map((m) => {
              if (m.sender_id !== myId) return { ...m, is_read: true };
              return m;
            });

            // Scroll to end if a new message was received
            if (msgs.length > prev.length) {
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            }

            return mapped;
          });
        }
      } catch (err) {
        console.warn("Error syncing messages:", err);
      }
    };

    const intervalId = setInterval(syncMessages, 4000); // Poll every 4 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [convId, myId]);

  // ── Message actions ─────────────────────────────────────────────────────────

  const deleteMessage = async (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", msgId)
      .eq("sender_id", myId);
    if (error) {
      Toast.show({ type: "error", text1: "Could not delete message" });
      const { data: msgs } = await supabase
        .from("messages")
        .select("*, profiles!sender_id(id, full_name, avatar_url)")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      setMessages(msgs ?? []);
    }
  };

  const startEdit = (msg: any) => {
    setEditingId(msg.id);
    const reply = parseReply(msg.body);
    setInput(reply ? reply.text : msg.body);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setInput("");
  };

  const handleReply = (msg: any) => {
    let previewBody = msg.body;
    const attach = parseAttachment(msg.body);
    if (attach) previewBody = "📷 Attachment";
    const reply = parseReply(msg.body);
    if (reply) previewBody = reply.text;

    setReplyingTo({
      id: msg.id,
      author: msg.profiles?.full_name ?? "User",
      body: previewBody,
    });
    inputRef.current?.focus();
  };

  const commitEdit = async () => {
    if (!editingId || !input.trim()) return;
    const newText = input.trim();
    const msgToEdit = messages.find((m) => m.id === editingId);
    let newBody = newText;
    if (msgToEdit) {
      const parsedReply = parseReply(msgToEdit.body);
      if (parsedReply)
        newBody = JSON.stringify({ ...parsedReply, text: newText });
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === editingId ? { ...m, body: newBody, edited: true } : m,
      ),
    );
    setEditingId(null);
    setInput("");
    const { error } = await supabase
      .from("messages")
      .update({ body: newBody })
      .eq("id", editingId)
      .eq("sender_id", myId);
    if (error) Toast.show({ type: "error", text1: "Could not edit message" });
  };

  const addReaction = (msgId: string, emoji: string) => {
    setReactions((prev) => {
      const list = prev[msgId] ?? [];
      if (list.includes(emoji))
        return { ...prev, [msgId]: list.filter((e) => e !== emoji) };
      return { ...prev, [msgId]: [...list, emoji] };
    });
  };

  const sendMessage = async () => {
    if (editingId) {
      commitEdit();
      return;
    }
    if (!input.trim() || !convId || sending) return;
    const text = input.trim();
    setInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let payload = text;
    if (replyingTo) {
      payload = JSON.stringify({ _type: "reply", replyTo: replyingTo, text });
      setReplyingTo(null);
    }

    const optimistic = {
      id: `opt_${Date.now()}`,
      _optimistic: true,
      conversation_id: convId,
      sender_id: myId,
      body: payload,
      created_at: new Date().toISOString(),
      profiles: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    setSending(true);
    const { error: sendError } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: myId,
      body: payload,
    });
    setSending(false);
    if (sendError) {
      setMessages((prev) =>
        prev.filter((m) => !(m._optimistic && m.body === text)),
      );
      Toast.show({
        type: "error",
        text1: "Message not sent",
        text2: sendError.message,
      });
    } else {
      // Record for streak tracking
      const today = new Date()
      const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString().split('T')[0]
      if (otherUserId) {
        supabase.rpc('record_chat_message', {
          other_user_id: otherUserId,
          client_date: localDate,
        }).then(({ data }) => {
          if (data) {
            const prev = chatStreak.streak_count
            const next = data.streak_count ?? 0
            setChatStreak({ streak_count: next, at_risk: data.at_risk ?? false, increased: next > prev })
            if (next > prev && next > 1) {
              Toast.show({ type: 'success', text1: `🔥 ${next} day streak!`, text2: 'Keep it going!' })
            }
          }
        })
      }
    }
  };

  const sendAttachment = async (key: AttachmentOptionKey) => {
    if (!convId) return;
    setUploading(true);
    try {
      let attach: Attachment | null = null;
      if (key === "stickers") {
        setShowAttachSheet(false);
        setShowStickerPicker(true);
        setUploading(false);
        return;
      }
      if (key === "camera") attach = await takePhoto(convId);
      if (key === "gallery") attach = await pickMedia(convId);
      if (key === "video") attach = await recordVideo(convId);
      if (!attach) {
        setUploading(false);
        setShowAttachSheet(false);
        return;
      }

      setShowAttachSheet(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const body = JSON.stringify(attach);
      const optimistic = {
        id: `opt_${Date.now()}`,
        _optimistic: true,
        conversation_id: convId,
        sender_id: myId,
        body,
        created_at: new Date().toISOString(),
        profiles: null,
      };
      setMessages((prev) => [...prev, optimistic]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      await supabase
        .from("messages")
        .insert({ conversation_id: convId, sender_id: myId, body });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Upload failed",
        text2: err?.message ?? "Please try again.",
      });
      setShowAttachSheet(false);
    } finally {
      setUploading(false);
    }
  };

  const otherName = otherProfile?.full_name ?? "Chat";
  const checkOnline = usePresenceStore((s) => s.isOnline);
  const isOnline = otherUserId ? checkOnline(otherUserId) : false;
  const hasText = input.trim().length > 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[s.container, { backgroundColor: theme.bg }]}
      edges={["top"]}
    >
      <AttachmentSheet
        visible={showAttachSheet}
        uploading={uploading}
        onClose={() => setShowAttachSheet(false)}
        onSelect={sendAttachment}
      />
      {selectedMsg && (
        <MessageActionsModal
          msg={selectedMsg}
          mine={selectedMsg.sender_id === myId}
          onClose={() => setSelectedMsg(null)}
          onEdit={() => startEdit(selectedMsg)}
          onDelete={() => deleteMessage(selectedMsg.id)}
          onReact={(emoji) => addReaction(selectedMsg.id, emoji)}
          onReply={() => handleReply(selectedMsg)}
          onSaveSticker={
            parseAttachment(selectedMsg.body)?._type === "image"
              ? async () => {
                  const url = parseAttachment(selectedMsg.body)!.url;
                  const { error } = await addSticker(url);
                  if (error)
                    Toast.show({
                      type: "error",
                      text1: "Failed",
                      text2: error.message,
                    });
                  else
                    Toast.show({
                      type: "success",
                      text1: "Saved to My Stickers",
                    });
                }
              : undefined
          }
        />
      )}

      <StickerPicker
        visible={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelectSticker={async (url, type) => {
          setShowStickerPicker(false)
          const attach: Attachment = { _type: type, url, width: 800, height: 800 }
          const body = JSON.stringify(attach)
          const optimistic = {
            id: `opt_${Date.now()}`,
            _optimistic: true,
            conversation_id: convId,
            sender_id: myId,
            body,
            created_at: new Date().toISOString(),
            profiles: null,
          };
          setMessages((prev) => [...prev, optimistic]);
          setTimeout(
            () => scrollRef.current?.scrollToEnd({ animated: true }),
            80,
          );
          const { error } = await supabase
            .from("messages")
            .insert({ conversation_id: convId, sender_id: myId, body });
          if (error) {
            setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
            Toast.show({
              type: "error",
              text1: "Failed to send sticker",
              text2: error.message,
            });
          }
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
      >
        {/* ── WhatsApp-style header ───────────────────────────────────────── */}
        <View
          style={[
            s.header,
            {
              backgroundColor: theme.card2,
              borderBottomColor: "rgba(167,139,250,0.15)",
              shadowColor: "#a78bfa",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
              elevation: 10,
            },
          ]}
        >
          {/* Purple scan-line glow — preserved as the app's online presence indicator */}
          <ScanLine isOnline={isOnline} />

          {/* Back arrow */}
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={theme.accent} />
          </TouchableOpacity>

          {/* Contact header: click to open profile */}
          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
            onPress={() =>
              otherUserId && router.push(`/profile/${otherUserId}` as any)
            }
            activeOpacity={0.7}
          >
            {/* Avatar (36px circle, WhatsApp spec) */}
            <View style={s.avatarWrap}>
              {otherProfile?.avatar_url ? (
                <Image
                  source={{ uri: otherProfile.avatar_url }}
                  style={[
                    s.avatar,
                    {
                      borderWidth: 2,
                      borderColor: isOnline
                        ? "#25D366"
                        : "rgba(167,139,250,0.3)",
                    },
                  ]}
                />
              ) : (
                <View
                  style={[
                    s.avatarFallback,
                    {
                      backgroundColor: theme.accentBg,
                      borderWidth: 2,
                      borderColor: isOnline
                        ? "#25D366"
                        : "rgba(167,139,250,0.3)",
                    },
                  ]}
                >
                  <Text style={s.avatarInitials}>{getInitials(otherName)}</Text>
                </View>
              )}
              {/* WhatsApp green online dot */}
              {isOnline && <PulseDot />}
            </View>

            {/* Name + status text */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text
                  style={[s.headerName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {otherName}
                </Text>
                {chatStreak.streak_count > 0 && (
                  <View style={[
                    s.streakChip,
                    chatStreak.at_risk
                      ? { backgroundColor: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.35)' }
                      : { backgroundColor: 'rgba(249,115,22,0.15)', borderColor: 'rgba(249,115,22,0.35)' },
                  ]}>
                    <Text style={s.streakChipText}>
                      {chatStreak.at_risk ? '⌛' : '🔥'} {chatStreak.streak_count}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  s.headerStatus,
                  { color: isOnline ? "#25D366" : theme.textFaint },
                ]}
              >
                {isOnline ? "Online" : "Last seen recently"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Right action icons: video call, voice call, three-dots menu */}
          <View style={s.headerActions}>
            <TouchableOpacity
              style={s.headerIconBtn}
              hitSlop={8}
              onPress={() =>
                Toast.show({
                  type: "info",
                  text1: "Coming soon",
                  text2: "Video calls are not yet available.",
                })
              }
            >
              <Ionicons
                name="videocam-outline"
                size={22}
                color={theme.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.headerIconBtn}
              hitSlop={8}
              onPress={() =>
                Toast.show({
                  type: "info",
                  text1: "Coming soon",
                  text2: "Voice calls are not yet available.",
                })
              }
            >
              <Ionicons name="call-outline" size={20} color={theme.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.headerIconBtn}
              hitSlop={8}
              onPress={() =>
                Toast.show({
                  type: "info",
                  text1: "Options",
                  text2: "More options coming soon.",
                })
              }
            >
              <Ionicons
                name="ellipsis-vertical"
                size={20}
                color={theme.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Message list with dot-pattern background ─────────────────────── */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Subtle dot-grid background — WhatsApp texture equivalent */}
            <ChatBackground />

            <ScrollView
              ref={scrollRef}
              style={s.messages}
              contentContainerStyle={{
                paddingHorizontal: 10,
                paddingTop: 10,
                paddingBottom: 12,
              }}
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 && <EmptyState name={otherName} />}

              {messages.map((m, i) => {
                const mine = m.sender_id === myId;
                const parsed = parseAttachment(m.body);
                const challenge = parseChallenge(m.body);
                const acceptance = parseAcceptance(m.body);
                const storyInteraction = parseStoryInteraction(m.body);
                const replyData = parseReply(m.body);

                // Day separator — inserted before a message if the day differs from the previous
                const prevMsg = messages[i - 1];
                const showSep =
                  i === 0 || !isSameDay(prevMsg?.created_at, m.created_at);
                const dayLabel = showSep ? getDayLabel(m.created_at) : "";

                // ── Story reaction / comment bubble ─────────────────────────
                if (storyInteraction) {
                  return (
                    <View key={m.id ?? i}>
                      {showSep && <DaySeparator label={dayLabel} />}
                      <View style={[s.msgRow, mine && s.msgRowMine]}>
                        <StoryInteractionBubble
                          interaction={storyInteraction}
                          mine={mine}
                        />
                      </View>
                    </View>
                  );
                }

                // ── Challenge bubble ────────────────────────────────────────
                if (challenge) {
                  return (
                    <View key={m.id ?? i}>
                      {showSep && <DaySeparator label={dayLabel} />}
                      <View style={[s.msgRow, mine && s.msgRowMine]}>
                        <ChallengeBubble
                          challenge={challenge}
                          mine={mine}
                          convId={convId!}
                          myId={myId}
                          otherUserId={otherUserId}
                          otherName={otherName}
                        />
                      </View>
                    </View>
                  );
                }

                // ── Acceptance bubble ───────────────────────────────────────
                if (acceptance) {
                  return (
                    <View key={m.id ?? i}>
                      {showSep && <DaySeparator label={dayLabel} />}
                      <View style={[s.msgRow, mine && s.msgRowMine]}>
                        <AcceptanceBubble
                          acceptance={acceptance}
                          otherUserId={otherUserId}
                          otherName={otherName}
                        />
                      </View>
                    </View>
                  );
                }

                // ── Regular message ─────────────────────────────────────────
                const msgReactions = reactions[m.id] ?? [];

                return (
                  <View key={m.id ?? i}>
                    {showSep && <DaySeparator label={dayLabel} />}
                    <View style={[s.msgRow, mine && s.msgRowMine]}>
                      <View style={s.bubbleWrap}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onLongPress={() => {
                            if (!m._optimistic) {
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Medium,
                              );
                              setSelectedMsg(m);
                            }
                          }}
                          delayLongPress={200}
                          style={[
                            s.bubble,
                            mine
                              ? [
                                  s.bubbleMine,
                                  {
                                    // Sent: purple tint matching app theme
                                    backgroundColor: "rgba(167,139,250,0.25)",
                                    shadowColor: "#a78bfa",
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: m._optimistic ? 0.1 : 0.35,
                                    shadowRadius: 8,
                                    elevation: m._optimistic ? 1 : 4,
                                    ...(parsed ? { padding: 4 } : {}),
                                  },
                                ]
                              : [
                                  s.bubbleTheirs,
                                  {
                                    // Received: dark card background
                                    backgroundColor: "rgba(255,255,255,0.07)",
                                    borderColor: "rgba(167,139,250,0.12)",
                                  },
                                ],
                            m._optimistic && { opacity: 0.6 },
                            editingId === m.id && {
                              borderWidth: 1.5,
                              borderColor: theme.accent,
                            },
                          ]}
                        >
                          {replyData && (
                            <QuotedBubble replyTo={replyData.replyTo} />
                          )}
                          {parsed ? (
                          <AttachmentBubble 
                              attachment={parsed} 
                              mine={mine} 
                              onLongPress={() => {
                                if (!m._optimistic) {
                                  import('expo-haptics').then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
                                  setSelectedMsg(m)
                                }
                              }} 
                            />
                          ) : (
                            <Text style={[s.bubbleText, { color: theme.text }]}>
                              {replyData ? replyData.text : m.body}
                            </Text>
                          )}

                          {/* Timestamp row inside bubble — WhatsApp style */}
                          <View style={s.bubbleMeta}>
                            {m.edited && (
                              <Text
                                style={[
                                  s.bubbleEdited,
                                  { color: theme.textFaint },
                                ]}
                              >
                                edited ·{" "}
                              </Text>
                            )}
                            <Text
                              style={[s.bubbleTime, { color: theme.textFaint }]}
                            >
                              {formatMsgTime(m.created_at)}
                            </Text>
                            {/* Tick status — only for sent messages */}
                            {mine && (
                              <TickStatus
                                optimistic={!!m._optimistic}
                                isRead={m.is_read === true}
                              />
                            )}
                          </View>
                        </TouchableOpacity>

                        {/* Reaction pills */}
                        {msgReactions.length > 0 && (
                          <View
                            style={[
                              s.reactionsRow,
                              mine && { justifyContent: "flex-end" },
                            ]}
                          >
                            {msgReactions.map((emoji, ri) => (
                              <TouchableOpacity
                                key={ri}
                                style={[
                                  s.reactionPill,
                                  {
                                    backgroundColor: theme.card2,
                                    borderColor: theme.accentBorder,
                                  },
                                ]}
                                onPress={() => addReaction(m.id, emoji)}
                              >
                                <Text style={s.reactionEmoji}>{emoji}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── WhatsApp-style input bar ────────────────────────────────────── */}
        <View
          style={[
            s.inputOuter,
            {
              backgroundColor: theme.card,
              borderTopColor: theme.border,
            },
          ]}
        >
          {/* Edit banner */}
          {editingId && (
            <View
              style={[
                s.editBanner,
                {
                  backgroundColor: theme.accentBg,
                  borderColor: theme.accentBorder,
                },
              ]}
            >
              <Ionicons name="pencil-outline" size={14} color={theme.accent} />
              <Text style={[s.editBannerText, { color: theme.accent }]}>
                Editing message
              </Text>
              <TouchableOpacity
                onPress={cancelEdit}
                style={{ marginLeft: "auto" }}
              >
                <Ionicons name="close" size={16} color={theme.accent} />
              </TouchableOpacity>
            </View>
          )}

          {/* Reply banner */}
          <ReplyBanner
            replyingTo={replyingTo}
            onCancel={() => setReplyingTo(null)}
          />

          <View
            style={[
              s.inputRow,
              { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 },
            ]}
          >
            {/* Attach icon — hidden while editing to match WhatsApp behavior */}
            {!editingId && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  style={s.attachIconBtn}
                  onPress={() => setShowAttachSheet(true)}
                  hitSlop={8}
                >
                  <Ionicons
                    name="attach-outline"
                    size={24}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ padding: 6, marginRight: 2 }}
                  onPress={() => setShowStickerPicker(true)}
                  hitSlop={8}
                >
                  <Ionicons
                    name="happy-outline"
                    size={24}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Pill-shaped text input */}
            <TextInput
              ref={inputRef}
              style={[
                s.input,
                {
                  backgroundColor: theme.card2,
                  borderColor: inputFocused
                    ? theme.accent
                    : theme.border,
                  color: theme.text,
                  shadowColor: inputFocused ? theme.accent : "transparent",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: inputFocused ? 0.3 : 0,
                  shadowRadius: 6,
                },
              ]}
              placeholder={editingId ? "Edit message…" : "Message"}
              placeholderTextColor={theme.textFaint}
              value={input}
              onChangeText={setInput}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
            />

            {/*
              Send / mic button:
              - When input is empty: mic icon (grey, un-filled) — WhatsApp style
              - When text exists or editing: purple filled circle with send/checkmark icon
            */}
            {hasText || editingId ? (
              <TouchableOpacity
                style={[
                  s.sendBtn,
                  {
                    backgroundColor: editingId ? "#34d399" : theme.accent,
                    shadowColor: editingId ? "#34d399" : theme.accent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 10,
                    elevation: 6,
                  },
                ]}
                onPress={sendMessage}
                disabled={sending || !convId}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name={editingId ? "checkmark" : "send"}
                    size={18}
                    color="#fff"
                  />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.micBtn, { borderColor: "rgba(167,139,250,0.2)" }]}
                activeOpacity={0.7}
                onPress={() =>
                  Toast.show({
                    type: "info",
                    text1: "Coming soon",
                    text2: "Voice messages are not yet available.",
                  })
                }
              >
                <Ionicons
                  name="mic-outline"
                  size={22}
                  color={theme.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
    position: "relative",
    overflow: "hidden",
  },
  backBtn: {
    // No background circle — WhatsApp uses a bare back arrow
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: {
    position: "relative",
    width: 36,
    height: 36,
  },
  // 36px circle as per WhatsApp spec
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    color: "#c4b5fd",
  },
  headerName: {
    fontSize: 14,
    fontFamily: typography.fontBold,
    lineHeight: 18,
  },
  headerStatus: {
    fontSize: 11,
    fontFamily: typography.fontRegular,
    marginTop: 1,
    lineHeight: 14,
  },
  streakChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 10, borderWidth: 0.5,
  },
  streakChipText: {
    fontSize: 11, fontFamily: typography.fontBold,
    color: '#f97316',
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  headerIconBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Message list ─────────────────────────────────────────────────────────────
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  messages: { flex: 1 },

  // ── Message rows ─────────────────────────────────────────────────────────────
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 3,
    // Full-width so the child bubbleWrap's maxWidth % resolves against screen width
    alignSelf: "stretch",
  },
  msgRowMine: {
    justifyContent: "flex-end",
  },

  // ── Bubble wrapper — maxWidth % MUST live here so it resolves against the ──────
  // ── full-width msgRow, not against the unconstrained inner TouchableOpacity ────
  bubbleWrap: {
    maxWidth: "78%",
  },

  // ── Bubble (no maxWidth here — constrained by bubbleWrap above) ───────────────
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: {
    borderBottomRightRadius: 2,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 2,
    borderWidth: 0.5,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: typography.fontRegular,
  },
  // Timestamp + tick row sits inside the bubble, bottom-right aligned
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 4,
  },
  bubbleEdited: {
    fontSize: 9,
    fontFamily: typography.fontRegular,
  },
  bubbleTime: {
    fontSize: 10,
    fontFamily: typography.fontRegular,
  },

  // ── Reactions ─────────────────────────────────────────────────────────────────
  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 0.5,
  },
  reactionEmoji: { fontSize: 14 },

  // ── Input bar ─────────────────────────────────────────────────────────────────
  inputOuter: {
    borderTopWidth: 1,
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  editBannerText: {
    fontSize: 12,
    fontFamily: typography.fontMedium,
    flex: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 6,
  },
  // Bare attach icon button — no circle background, matches WhatsApp
  attachIconBtn: {
    paddingHorizontal: 4,
    paddingBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  // Pill-shaped input — WhatsApp style rounded text field
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    fontFamily: typography.fontRegular,
    borderWidth: 1,
    maxHeight: 120,
  },
  // Purple filled circle send button
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  // Unfilled mic button for empty-input state
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
