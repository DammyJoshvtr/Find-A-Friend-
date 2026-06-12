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

// ─── Challenge bubble ─────────────────────────────────────────────────────────

function ChallengeBubble({
  challenge,
  mine,
  convId,
  myId,
  otherUserId,
  otherName,
}: {
  challenge: { gameType: string; emoji: string; label: string };
  mine: boolean;
  convId: string;
  myId: string;
  otherUserId: string;
  otherName: string;
}) {
  const theme = useTheme();
  const meta = GAME_META[challenge.gameType as GameType];

  const handleAccept = async () => {
    const gameType = challenge.gameType as GameType;

    // Navigate to waiting room first
    router.push({
      pathname: "/play/waiting",
      params: {
        gameType,
        opponentId: otherUserId,
        opponentName: otherName,
      },
    } as any);

    // Send acceptance message
    await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: myId,
      body: JSON.stringify({
        _type: "challenge_accepted",
        gameType: challenge.gameType,
        emoji: challenge.emoji,
        label: challenge.label,
        sessionId: "", // Will be matched by opponentId in waiting room
      }),
    });
  };

  const handleDecline = async () => {
    await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: myId,
      body: `❌ Declined the ${challenge.emoji} ${challenge.label} challenge.`,
    });
  };

  return (
    <View
      style={[
        cb.card,
        {
          backgroundColor: meta?.bg ?? "rgba(167,139,250,0.1)",
          borderColor: meta?.border ?? "rgba(167,139,250,0.3)",
        },
      ]}
    >
      <Text style={cb.emoji}>{challenge.emoji}</Text>
      <Text style={[cb.tag, { color: theme.textFaint }]}>GAME CHALLENGE</Text>
      <Text style={[cb.label, { color: meta?.color ?? theme.accent }]}>
        {challenge.label}
      </Text>
      {mine ? (
        <Text style={[cb.waiting, { color: theme.textFaint }]}>
          Waiting for response…
        </Text>
      ) : (
        <View style={cb.btns}>
          <TouchableOpacity style={cb.declineBtn} onPress={handleDecline}>
            <Text style={cb.declineText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              cb.acceptBtn,
              { backgroundColor: meta?.color ?? theme.accent },
            ]}
            onPress={handleAccept}
          >
            <Text style={cb.acceptText}>Accept ⚡</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const cb = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
    minWidth: 210,
  },
  emoji: { fontSize: 44, marginBottom: 2 },
  tag: { fontSize: 10, fontFamily: typography.fontMedium, letterSpacing: 1 },
  label: { fontSize: 17, fontFamily: typography.fontBold, marginBottom: 2 },
  waiting: { fontSize: 12, fontFamily: typography.fontRegular, marginTop: 8 },
  btns: { flexDirection: "row", gap: 10, marginTop: 12 },
  declineBtn: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.5)",
  },
  declineText: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    color: "#f87171",
  },
  acceptBtn: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9 },
  acceptText: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    color: "#fff",
  },
});

// ─── Acceptance bubble ────────────────────────────────────────────────────────

function AcceptanceBubble({
  acceptance,
  otherUserId,
  otherName,
}: {
  acceptance: { gameType: string; emoji: string; label: string };
  otherUserId: string;
  otherName: string;
}) {
  const theme = useTheme();

  const handleJoin = () => {
    router.push({
      pathname: "/play/waiting",
      params: {
        gameType: acceptance.gameType,
        opponentId: otherUserId,
        opponentName: otherName,
      },
    } as any);
  };

  return (
    <View
      style={[
        ab.card,
        {
          backgroundColor: "rgba(74,222,128,0.08)",
          borderColor: "rgba(74,222,128,0.25)",
        },
      ]}
    >
      <View style={ab.top}>
        <Text style={ab.emoji}>{acceptance.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[ab.title, { color: theme.text }]}>
            Challenge Accepted!
          </Text>
          <Text style={[ab.sub, { color: theme.textFaint }]}>
            Let's play {acceptance.label}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[ab.btn, { backgroundColor: "#10b981" }]}
        onPress={handleJoin}
      >
        <Text style={ab.btnText}>Join Game ⚡</Text>
      </TouchableOpacity>
    </View>
  );
}

const ab = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    minWidth: 210,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  emoji: { fontSize: 34 },
  title: { fontSize: 14, fontFamily: typography.fontBold },
  sub: { fontSize: 11, fontFamily: typography.fontRegular },
  btn: { borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  btnText: { fontSize: 13, fontFamily: typography.fontBold, color: "#fff" },
});

// ─── Story interaction bubble ─────────────────────────────────────────────────

function StoryInteractionBubble({
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

// ─── Message actions modal ────────────────────────────────────────────────────

const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

function MessageActionsModal({
  msg,
  mine,
  onClose,
  onEdit,
  onDelete,
  onReact,
  onReply,
  onSaveSticker,
}: {
  msg: any;
  mine: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onSaveSticker?: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={ma.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={[
          ma.sheet,
          { backgroundColor: theme.card2, borderColor: theme.accentBorder },
        ]}
      >
        <View style={[ma.handle, { backgroundColor: theme.border2 }]} />

        {/* Emoji reactions row */}
        <View style={ma.reactRow}>
          {REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[
                ma.reactBtn,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => {
                onReact(emoji);
                onClose();
              }}
            >
              <Text style={ma.reactEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[ma.divider, { backgroundColor: theme.border }]} />

        <TouchableOpacity
          style={ma.actionRow}
          onPress={() => {
            onReply();
            onClose();
          }}
        >
          <Ionicons name="arrow-undo-outline" size={18} color={theme.accent} />
          <Text style={[ma.actionLabel, { color: theme.text }]}>Reply</Text>
        </TouchableOpacity>

        {onSaveSticker && (
          <TouchableOpacity
            style={ma.actionRow}
            onPress={() => {
              onSaveSticker();
              onClose();
            }}
          >
            <Ionicons name="star-outline" size={18} color="#eab308" />
            <Text style={[ma.actionLabel, { color: theme.text }]}>
              ⭐ Save as Sticker
            </Text>
          </TouchableOpacity>
        )}

        {mine && (
          <TouchableOpacity
            style={ma.actionRow}
            onPress={() => {
              onEdit();
              onClose();
            }}
          >
            <Ionicons name="pencil-outline" size={18} color={theme.accent} />
            <Text style={[ma.actionLabel, { color: theme.text }]}>
              Edit message
            </Text>
          </TouchableOpacity>
        )}
        {mine && (
          <TouchableOpacity
            style={ma.actionRow}
            onPress={() => {
              onDelete();
              onClose();
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#f87171" />
            <Text style={[ma.actionLabel, { color: "#f87171" }]}>
              Delete message
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={ma.cancelRow} onPress={onClose}>
          <Text style={[ma.cancelLabel, { color: theme.textMuted }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const ma = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 34,
    borderWidth: 0.5,
    borderBottomWidth: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  reactRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  reactBtn: { padding: 8, borderRadius: 14, borderWidth: 0.5 },
  reactEmoji: { fontSize: 26 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  actionLabel: { fontSize: 15, fontFamily: typography.fontMedium },
  cancelRow: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  cancelLabel: { fontSize: 14, fontFamily: typography.fontMedium },
});

const att = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    borderWidth: 0.5,
    borderBottomWidth: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    marginBottom: 18,
    textAlign: "center",
  },
  grid: { flexDirection: "row", gap: 12, marginBottom: 20 },
  option: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 0.5,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  optionLabel: { fontSize: 11, fontFamily: typography.fontMedium },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 0.5,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontFamily: typography.fontMedium },
  uploadingRow: { alignItems: "center", gap: 12, paddingVertical: 32 },
  uploadingText: { fontSize: 13, fontFamily: typography.fontRegular },
});

// ─── Attachment bubble ────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get("window").width;

function AttachmentBubble({
  attachment,
}: {
  attachment: Attachment;
  mine: boolean;
}) {
  const handleOpen = () => Linking.openURL(attachment.url).catch(() => {});

  if (attachment._type === "image") {
    const imgW = Math.min(SCREEN_W * 0.65, 260);
    const aspectH =
      attachment.width && attachment.height
        ? imgW * (attachment.height / attachment.width)
        : imgW;
    return (
      <TouchableOpacity onPress={handleOpen} activeOpacity={0.85}>
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
    <TouchableOpacity
      style={[attb.videoWrap, { backgroundColor: "rgba(0,0,0,0.4)" }]}
      onPress={handleOpen}
      activeOpacity={0.85}
    >
      <View style={attb.playBtn}>
        <Ionicons name="play" size={24} color="#fff" />
      </View>
      <View style={attb.videoInfo}>
        <Ionicons name="videocam" size={14} color="rgba(255,255,255,0.8)" />
        <Text style={attb.videoLabel}>{attachment.name ?? "Video"}</Text>
      </View>
    </TouchableOpacity>
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
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
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
    } catch (err) {
      console.error("Init error:", err);
      setLoading(false);
    }
  }, [otherUserId]);

  useEffect(() => {
    initConversation();
  }, [initConversation]);

  // ── Realtime subscriptions ──────────────────────────────────────────────────

  useEffect(() => {
    if (!convId) return;
    const channelName = `dm-chat:${convId}`;
    const stale = supabase
      .getChannels()
      .find((c) => c.topic === `realtime:${channelName}`);
    if (stale) supabase.removeChannel(stale);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "conversation_id=eq." + convId,
        },
        async (payload: any) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", payload.new.sender_id)
            .single();

          // Mark as read immediately if message is from the other person
          if (payload.new.sender_id !== myId) {
            supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", payload.new.id)
              .then(() => {});
          }

          setMessages((prev) => {
            const idx = prev.findIndex(
              (m) =>
                m._optimistic &&
                m.body === payload.new.body &&
                m.sender_id === payload.new.sender_id,
            );
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...payload.new, profiles: profile };
              return updated;
            }
            const newMsg = { ...payload.new, profiles: profile };
            if (payload.new.sender_id !== myId) newMsg.is_read = true;
            return [...prev, newMsg];
          });
          setTimeout(
            () => scrollRef.current?.scrollToEnd({ animated: true }),
            80,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: "conversation_id=eq." + convId,
        },
        (payload: any) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? { ...m, ...payload.new } : m,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: "conversation_id=eq." + convId,
        },
        (payload: any) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old?.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [convId]);

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
        onSelectSticker={(url) => {
          setShowStickerPicker(false);
          const attach: Attachment = {
            _type: "image",
            url,
            width: 800,
            height: 800,
          };
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
          setTimeout(
            () => scrollRef.current?.scrollToEnd({ animated: true }),
            80,
          );
          supabase
            .from("messages")
            .insert({ conversation_id: convId, sender_id: myId, body });
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
              <Text
                style={[s.headerName, { color: theme.text }]}
                numberOfLines={1}
              >
                {otherName}
              </Text>
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
                            <AttachmentBubble attachment={parsed} mine={mine} />
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
              backgroundColor: "rgba(13,13,20,0.97)",
              borderTopColor: "rgba(167,139,250,0.2)",
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
              <TouchableOpacity
                style={s.attachIconBtn}
                onPress={() => setShowAttachSheet(true)}
                hitSlop={8}
              >
                {/* Paperclip / attach icon */}
                <Ionicons
                  name="attach-outline"
                  size={24}
                  color={theme.textMuted}
                />
              </TouchableOpacity>
            )}

            {/* Pill-shaped text input */}
            <TextInput
              ref={inputRef}
              style={[
                s.input,
                {
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderColor: inputFocused
                    ? "rgba(167,139,250,0.5)"
                    : "rgba(167,139,250,0.15)",
                  color: theme.text,
                  shadowColor: inputFocused ? "#a78bfa" : "transparent",
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
