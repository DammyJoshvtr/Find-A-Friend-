/**
 * app/feedback.tsx
 * Campus Voice — futuristic feedback board.
 * Schema lives in: supabase/migrations/20260512000000_feedback_and_comments.sql
 */
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { getInitials, getTimeAgo } from "../lib/matching";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import { typography } from "../lib/typography";
import { useAuthStore } from "../store/authStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackItem {
  id: string;
  author_id: string;
  body: string;
  upvotes: number;
  downvotes: number;
  comments_count: number;
  created_at: string;
  myVote?: 1 | -1 | null;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
}

interface FeedbackComment {
  id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  likes_count: number;
  myLike?: boolean;
  profiles?: { full_name: string | null } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PURPLE = "#a78bfa";
const PURPLE_DIM = "rgba(167,139,250,0.18)";
const PURPLE_BORDER = "rgba(167,139,250,0.35)";
const GREEN_DIM = "rgba(52,211,153,0.15)";
const RED_DIM = "rgba(248,113,113,0.15)";
const MAX_BODY = 500;

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  name,
  size = 32,
}: {
  name: string | null | undefined;
  size?: number;
}) {
  const initials = getInitials(name ?? "A");
  return (
    <View
      style={[av.circle, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[av.text, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

const av = StyleSheet.create({
  circle: {
    backgroundColor: PURPLE_DIM,
    borderWidth: 1,
    borderColor: PURPLE_BORDER,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  text: {
    color: PURPLE,
    fontFamily: typography.fontBold,
    letterSpacing: 0.5,
  },
});

// ─── Inline Comments Section ──────────────────────────────────────────────────

function CommentsSection({
  feedbackId,
  myId,
  theme,
  onCommentAdded,
}: {
  feedbackId: string;
  myId: string;
  theme: ReturnType<typeof useTheme>;
  onCommentAdded: () => void;
}) {
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(
    null,
  );

  const fetchComments = useCallback(async () => {
    try {
      const { data: cData } = await supabase
        .from("feedback_comments")
        .select("*")
        .eq("feedback_id", feedbackId)
        .order("created_at", { ascending: true });

      if (!cData || cData.length === 0) {
        setComments([]);
        return;
      }

      const uids = [...new Set(cData.map((c: any) => c.author_id))];
      const { data: pData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", uids);
      const likedRes = myId
        ? await supabase
            .from("feedback_comment_likes")
            .select("comment_id")
            .eq("user_id", myId)
            .in(
              "comment_id",
              cData.map((c: any) => c.id),
            )
        : { data: [] };
      const pMap = new Map(pData?.map((p: any) => [p.id, p]) ?? []);
      const likedSet = new Set(
        (likedRes.data ?? []).map((l: any) => l.comment_id),
      );

      setComments(
        cData.map((c: any) => ({
          ...c,
          parent_id: c.parent_id ?? null,
          likes_count: c.likes_count ?? 0,
          profiles: pMap.get(c.author_id) ?? null,
          myLike: likedSet.has(c.id),
        })),
      );
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [feedbackId, myId]);

  useEffect(() => {
    let active = true;
    fetchComments();

    const channel = supabase
      .channel(`comments-${feedbackId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feedback_comments",
          filter: `feedback_id=eq.${feedbackId}`,
        },
        async (payload) => {
          if (!active) return;
          const newC = payload.new as any;
          const { data: pData } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", newC.author_id)
            .single();
          setComments((prev) => {
            if (prev.find((c) => c.id === newC.id)) return prev;
            return [
              ...prev,
              {
                ...newC,
                parent_id: newC.parent_id ?? null,
                likes_count: 0,
                profiles: pData ?? null,
                myLike: false,
              },
            ];
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [feedbackId, fetchComments]);

  const handleLike = useCallback(
    async (c: FeedbackComment) => {
      if (!myId) return;
      const wasLiked = c.myLike;
      setComments((prev) =>
        prev.map((x) =>
          x.id !== c.id
            ? x
            : {
                ...x,
                myLike: !wasLiked,
                likes_count: wasLiked
                  ? Math.max(0, x.likes_count - 1)
                  : x.likes_count + 1,
              },
        ),
      );
      if (wasLiked) {
        await supabase
          .from("feedback_comment_likes")
          .delete()
          .eq("comment_id", c.id)
          .eq("user_id", myId);
      } else {
        await supabase
          .from("feedback_comment_likes")
          .insert({ user_id: myId, comment_id: c.id });
      }
    },
    [myId],
  );

  const handleDelete = async (c: FeedbackComment) => {
    if (c.author_id !== myId) return;
    const { error } = await supabase
      .from("feedback_comments")
      .delete()
      .eq("id", c.id);
    if (error) {
      Toast.show({
        type: "error",
        text1: "Could not delete",
        text2: error.message,
      });
    } else {
      setComments((prev) => prev.filter((x) => x.id !== c.id));
      onCommentAdded(); // Refresh count
      Toast.show({ type: "success", text1: "Reply deleted" });
    }
  };

  const handleSend = async () => {
    const text = newComment.trim();
    if (!text || !myId) return;
    setSending(true);
    const payload: any = {
      feedback_id: feedbackId,
      author_id: myId,
      body: text,
    };
    if (replyTo) payload.parent_id = replyTo.id;
    const { error } = await supabase.from("feedback_comments").insert(payload);
    setSending(false);
    if (error) {
      Toast.show({
        type: "error",
        text1: "Could not send",
        text2: error.message,
      });
      return;
    }
    setNewComment("");
    setReplyTo(null);
    onCommentAdded();
  };

  // Build two-level tree
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesFor = (pid: string) =>
    comments.filter((c) => c.parent_id === pid);

  const renderBubble = (c: FeedbackComment, isReply = false) => (
    <View
      key={c.id}
      style={[
        cs.row,
        c.author_id === myId && cs.rowMe,
        isReply && cs.replyIndent,
      ]}
    >
      {c.author_id !== myId && (
        <View style={cs.avatarWrap}>
          <Avatar name={c.profiles?.full_name} size={isReply ? 22 : 28} />
        </View>
      )}
      <View
        style={[
          cs.bubble,
          c.author_id === myId ? cs.bubbleMe : cs.bubbleOther,
          isReply && cs.replyBubble,
        ]}
      >
        <View style={cs.bubbleHeader}>
          <Text style={[cs.author, { color: PURPLE }]} numberOfLines={1}>
            {c.author_id === myId
              ? "You"
              : (c.profiles?.full_name ?? "Anonymous")}
          </Text>
          <Text style={[cs.time, { color: theme.textFaint }]}>
            {getTimeAgo(c.created_at)}
          </Text>
        </View>
        <Text style={[cs.body, { color: theme.textMuted }]}>{c.body}</Text>
        <View style={cs.commentActions}>
          {/* Like */}
          <TouchableOpacity style={cs.actionChip} onPress={() => handleLike(c)}>
            <Ionicons
              name={c.myLike ? "heart" : "heart-outline"}
              size={12}
              color={c.myLike ? "#f87171" : theme.textFaint}
            />
            {c.likes_count > 0 && (
              <Text style={[cs.chipText, { color: theme.textFaint }]}>
                {c.likes_count}
              </Text>
            )}
          </TouchableOpacity>
          {/* Reply — only on top-level, only to others */}
          {!isReply && c.author_id !== myId && (
            <TouchableOpacity
              style={cs.actionChip}
              onPress={() =>
                setReplyTo({
                  id: c.id,
                  name: c.profiles?.full_name ?? "Anonymous",
                })
              }
            >
              <Ionicons
                name="return-down-forward-outline"
                size={12}
                color={theme.textFaint}
              />
              <Text style={[cs.chipText, { color: theme.textFaint }]}>
                Reply
              </Text>
            </TouchableOpacity>
          )}
          {/* Delete — only if mine */}
          {c.author_id === myId && (
            <TouchableOpacity
              style={cs.actionChip}
              onPress={() => handleDelete(c)}
            >
              <Ionicons name="trash-outline" size={12} color="#f87171" />
              <Text style={[cs.chipText, { color: "#f87171" }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[cs.wrap, { borderTopColor: PURPLE_BORDER }]}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={PURPLE}
          style={{ marginVertical: 8 }}
        />
      ) : comments.length === 0 ? (
        <Text style={[cs.empty, { color: theme.textFaint }]}>
          No comments yet
        </Text>
      ) : (
        topLevel.map((c) => (
          <View key={c.id}>
            {renderBubble(c, false)}
            {repliesFor(c.id).length > 0 && (
              <View style={cs.repliesWrap}>
                {repliesFor(c.id).map((r) => renderBubble(r, true))}
              </View>
            )}
          </View>
        ))
      )}

      {/* Reply banner */}
      {replyTo && (
        <View
          style={[
            cs.replyBanner,
            { backgroundColor: PURPLE_DIM, borderColor: PURPLE_BORDER },
          ]}
        >
          <Text style={[cs.replyBannerText, { color: PURPLE }]}>
            ↩ Replying to {replyTo.name}
          </Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close-circle" size={14} color={PURPLE} />
          </TouchableOpacity>
        </View>
      )}

      {/* Compose */}
      <View style={cs.inputRow}>
        <TextInput
          style={[
            cs.input,
            {
              backgroundColor: theme.card2,
              color: theme.text,
              borderColor: PURPLE_BORDER,
            },
          ]}
          placeholder={
            replyTo ? `Reply to ${replyTo.name}...` : "Add a comment..."
          }
          placeholderTextColor={theme.textFaint}
          value={newComment}
          onChangeText={setNewComment}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={!sending}
        />
        <TouchableOpacity
          style={[
            cs.sendBtn,
            (!newComment.trim() || sending) && { opacity: 0.4 },
          ]}
          onPress={handleSend}
          disabled={!newComment.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={14} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cs = StyleSheet.create({
  wrap: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  empty: {
    fontSize: 11,
    fontFamily: typography.fontRegular,
    textAlign: "center",
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    marginBottom: 4,
  },
  rowMe: { flexDirection: "row-reverse" },
  replyIndent: { paddingLeft: 20 },
  repliesWrap: { paddingLeft: 34, gap: 2, marginTop: 2, marginBottom: 4 },
  avatarWrap: { flexShrink: 0, marginBottom: 2 },
  bubble: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.15)",
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bubbleOther: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 16,
    backgroundColor: "rgba(167,139,250,0.05)",
  },
  bubbleMe: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 16,
    backgroundColor: "rgba(167,139,250,0.12)",
    borderColor: "rgba(167,139,250,0.3)",
  },
  replyBubble: { borderRadius: 12 },
  bubbleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
    gap: 8,
  },
  author: { fontSize: 11, fontFamily: typography.fontBold, flexShrink: 1 },
  time: { fontSize: 9, fontFamily: typography.fontRegular, flexShrink: 0 },
  body: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    lineHeight: 19,
    flexWrap: "wrap",
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 5,
  },
  actionChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  chipText: { fontSize: 10, fontFamily: typography.fontRegular },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  replyBannerText: { fontSize: 11, fontFamily: typography.fontMedium },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 4,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    fontFamily: typography.fontRegular,
    minHeight: 36,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
});

// ─── Feedback Card ────────────────────────────────────────────────────────────

const FeedbackCard = React.memo(function FeedbackCard({
  item,
  myId,
  theme,
  onVote,
  onCommentAdded,
  onEdited,
}: {
  item: FeedbackItem;
  myId: string;
  theme: ReturnType<typeof useTheme>;
  onVote: (id: string, vote: 1 | -1) => void;
  onCommentAdded: (id: string) => void;
  onEdited: (id: string, newBody: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.body);
  const [saving, setSaving] = useState(false);
  const isMe = item.author_id === myId;
  const score = item.upvotes - item.downvotes;
  const authorName = isMe ? "You" : (item.profiles?.full_name ?? "Anonymous");

  const handleSaveEdit = async () => {
    const text = editText.trim();
    if (!text || text === item.body) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("feedbacks")
      .update({ body: text })
      .eq("id", item.id);
    setSaving(false);
    if (error) {
      Toast.show({
        type: "error",
        text1: "Could not save",
        text2: error.message,
      });
      return;
    }
    onEdited(item.id, text);
    setEditing(false);
  };

  return (
    <View style={[fc.row, isMe && fc.rowMe]}>
      {/* Avatar — left for others, hidden for self */}
      {!isMe && (
        <View style={fc.avatarCol}>
          <Avatar name={item.profiles?.full_name} size={36} />
        </View>
      )}

      <View style={[fc.bubbleWrap, isMe && fc.bubbleWrapMe]}>
        {/* Bubble */}
        <View
          style={[
            fc.bubble,
            isMe ? fc.bubbleMe : fc.bubbleOther,
            { backgroundColor: isMe ? "rgba(167,139,250,0.14)" : theme.card },
          ]}
        >
          {/* Author + time + edit button */}
          <View style={fc.bubbleHeader}>
            <Text
              style={[fc.authorName, { color: isMe ? PURPLE : theme.text }]}
              numberOfLines={1}
            >
              {authorName}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text style={[fc.time, { color: theme.textFaint }]}>
                {getTimeAgo(item.created_at)}
              </Text>
              {isMe && !editing && (
                <TouchableOpacity
                  onPress={() => {
                    setEditText(item.body);
                    setEditing(true);
                  }}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={13}
                    color={theme.textFaint}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Message body or edit input */}
          {editing ? (
            <View style={fc.editWrap}>
              <TextInput
                style={[
                  fc.editInput,
                  {
                    color: theme.text,
                    borderColor: PURPLE_BORDER,
                    backgroundColor: theme.card2,
                  },
                ]}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
                maxLength={MAX_BODY}
              />
              <View style={fc.editActions}>
                <TouchableOpacity
                  onPress={() => setEditing(false)}
                  style={fc.editCancelBtn}
                >
                  <Text style={{ color: theme.textFaint, fontSize: 12 }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveEdit}
                  style={[fc.editSaveBtn, saving && { opacity: 0.5 }]}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 12,
                        fontFamily: typography.fontSemiBold,
                      }}
                    >
                      Save
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={[fc.body, { color: theme.textMuted }]}>
              {item.body}
            </Text>
          )}

          {/* Actions */}
          {!editing && (
            <View style={fc.actionsRow}>
              <View style={fc.voteCluster}>
                <TouchableOpacity
                  style={[
                    fc.voteBtn,
                    item.myVote === 1 && {
                      backgroundColor: GREEN_DIM,
                      borderColor: "rgba(52,211,153,0.35)",
                    },
                  ]}
                  onPress={() => onVote(item.id, 1)}
                  accessibilityLabel="Upvote"
                >
                  <Ionicons
                    name="arrow-up"
                    size={14}
                    color={item.myVote === 1 ? "#34d399" : theme.textMuted}
                  />
                </TouchableOpacity>

                <Text
                  style={[
                    fc.score,
                    {
                      color:
                        score > 0
                          ? "#34d399"
                          : score < 0
                            ? "#f87171"
                            : theme.textMuted,
                    },
                  ]}
                >
                  {score}
                </Text>

                <TouchableOpacity
                  style={[
                    fc.voteBtn,
                    item.myVote === -1 && {
                      backgroundColor: RED_DIM,
                      borderColor: "rgba(248,113,113,0.35)",
                    },
                  ]}
                  onPress={() => onVote(item.id, -1)}
                  accessibilityLabel="Downvote"
                >
                  <Ionicons
                    name="arrow-down"
                    size={14}
                    color={item.myVote === -1 ? "#f87171" : theme.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <Pressable
                style={[
                  fc.commentPill,
                  expanded && {
                    backgroundColor: PURPLE_DIM,
                    borderColor: PURPLE_BORDER,
                  },
                ]}
                onPress={() => setExpanded((e) => !e)}
                accessibilityLabel={`${item.comments_count} comments`}
              >
                <Ionicons
                  name={expanded ? "chatbubble" : "chatbubble-outline"}
                  size={12}
                  color={expanded ? PURPLE : theme.textFaint}
                />
                <Text
                  style={[
                    fc.commentCount,
                    { color: expanded ? PURPLE : theme.textFaint },
                  ]}
                >
                  {item.comments_count}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Inline comments */}
        {expanded && (
          <View style={fc.commentsWrap}>
            <CommentsSection
              feedbackId={item.id}
              myId={myId}
              theme={theme}
              onCommentAdded={() => onCommentAdded(item.id)}
            />
          </View>
        )}
      </View>

      {/* Spacer for self-messages to keep bubble left-padded */}
      {isMe && <View style={{ width: 44 }} />}
    </View>
  );
});

const fc = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 4,
    gap: 8,
  },
  rowMe: { flexDirection: "row-reverse" },
  avatarCol: { flexShrink: 0, marginBottom: 2 },
  bubbleWrap: { flex: 1, minWidth: 0 },
  bubbleWrapMe: { alignItems: "flex-end" },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: PURPLE_BORDER,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  bubbleOther: {
    borderTopLeftRadius: 4,
  },
  bubbleMe: {
    borderTopRightRadius: 4,
    borderColor: "rgba(167,139,250,0.4)",
  },
  bubbleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },
  authorName: { fontSize: 12, fontFamily: typography.fontBold, flexShrink: 1 },
  time: { fontSize: 10, fontFamily: typography.fontRegular, flexShrink: 0 },
  body: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    lineHeight: 21,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(167,139,250,0.12)",
    paddingTop: 8,
    marginTop: 2,
  },
  voteCluster: { flexDirection: "row", alignItems: "center", gap: 6 },
  voteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  score: {
    fontSize: 13,
    fontFamily: typography.fontBold,
    minWidth: 24,
    textAlign: "center",
  },
  commentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  commentCount: { fontSize: 12, fontFamily: typography.fontMedium },
  commentsWrap: {
    marginTop: 6,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "rgba(167,139,250,0.04)",
  },
  editWrap: { marginTop: 6, gap: 8 },
  editInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: typography.fontRegular,
    lineHeight: 20,
    minHeight: 60,
    textAlignVertical: "top",
  },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  editCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: PURPLE,
  },
});

// ─── Compose Box ──────────────────────────────────────────────────────────────

function ComposeBox({
  myId,
  theme,
  insetBottom,
  onPosted,
}: {
  myId: string;
  theme: ReturnType<typeof useTheme>;
  insetBottom: number;
  onPosted: () => void;
}) {
  const [body, setBody] = useState("");
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);

  const glowOpacity = useSharedValue(0.35);
  useEffect(() => {
    if (focused) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 800 }),
          withTiming(0.45, { duration: 800 }),
        ),
        -1,
        true,
      );
    } else {
      glowOpacity.value = withTiming(0.2, { duration: 400 });
    }
  }, [focused]);

  const animBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(167,139,250,${glowOpacity.value})`,
    shadowOpacity: focused ? glowOpacity.value * 0.5 : 0,
  }));

  const btnScale = useSharedValue(1);
  const animBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const handleSend = async () => {
    const text = body.trim();
    if (!text) return;
    if (!myId) {
      Toast.show({
        type: "error",
        text1: "Not identified",
        text2: "Please log in again.",
      });
      return;
    }
    if (text.length > MAX_BODY) {
      Toast.show({
        type: "error",
        text1: "Too long",
        text2: `Max ${MAX_BODY} characters`,
      });
      return;
    }
    setSending(true);
    btnScale.value = withRepeat(
      withSequence(
        withTiming(0.88, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      ),
      -1,
      true,
    );

    const { error } = await supabase
      .from("feedbacks")
      .insert({ author_id: myId, body: text });

    btnScale.value = withSpring(1);
    setSending(false);

    if (error) {
      Toast.show({
        type: "error",
        text1: "Could not transmit",
        text2: error.message,
      });
      return;
    }
    setBody("");
    Toast.show({ type: "success", text1: "Transmission sent" });
    onPosted();
  };

  const remaining = MAX_BODY - body.length;
  const overLimit = remaining < 0;

  // ===================================
  // Text Input UI Field...
  // ===================================
  return (
    <View
      style={[
        cb.wrap,
        {
          paddingBottom: Math.max(insetBottom, 12),
        },
      ]}
    >
      <Animated.View
        style={[
          cb.inputWrap,
          animBorderStyle,
          {
            backgroundColor: theme.card2,
            shadowColor: PURPLE,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 14,
            elevation: 0,
          },
        ]}
      >
        <TextInput
          style={[cb.input, { color: theme.text }]}
          placeholder="Share your thoughts"
          placeholderTextColor={theme.textFaint}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={MAX_BODY + 10}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel="Compose feedback"
        />
        <Animated.View style={animBtnStyle}>
          <TouchableOpacity
            style={[
              cb.sendBtn,
              (overLimit || sending || !body.trim()) && { opacity: 0.45 },
            ]}
            onPress={handleSend}
            disabled={overLimit || sending || !body.trim()}
            accessibilityLabel="Send feedback"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </Animated.View>
        <View style={{ position: "absolute", right: 14, bottom: 2 }}>
          <Text
            style={[
              cb.counter,
              { color: overLimit ? "#f87171" : theme.textFaint },
            ]}
          >
            {remaining} Left
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const cb = StyleSheet.create({
  wrap: { borderTopWidth: 1, paddingHorizontal: 10, paddingTop: 12 },
  inputWrap: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 10,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  input: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    lineHeight: 20,
    minHeight: 50,
    maxHeight: 120,
    width: "75%",
    textAlignVertical: "top",
  },
  counter: { fontSize: 11, fontFamily: typography.fontRegular },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
});

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={em.wrap}>
      <View style={em.iconRing}>
        <Ionicons name="radio-outline" size={34} color={PURPLE} />
      </View>
      <Text style={[em.title, { color: theme.text }]}>
        No Transmissions Yet
      </Text>
      <Text style={[em.sub, { color: theme.textFaint }]}>
        Be the first to broadcast your thoughts to the campus.
      </Text>
    </View>
  );
}

const em = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 72,
    paddingHorizontal: 32,
    gap: 14,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: PURPLE_BORDER,
    backgroundColor: PURPLE_DIM,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 4,
  },
  title: { fontSize: 16, fontFamily: typography.fontBold, textAlign: "center" },
  sub: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    textAlign: "center",
    lineHeight: 19,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FeedbackScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const myId = user?.id ?? "";

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tableError, setTableError] = useState(false);
  const itemsRef = useRef<FeedbackItem[]>([]);
  itemsRef.current = items;

  const load = useCallback(async () => {
    setTableError(false);
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      const { data: fData, error } = await supabase
        .from("feedbacks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);

      if (error) {
        if (error.code === "42P01") setTableError(true);
        else
          Toast.show({
            type: "error",
            text1: "Load failed",
            text2: error.message,
          });
        return;
      }

      let hydrated = fData ?? [];
      if (hydrated.length > 0) {
        const uids = [...new Set(hydrated.map((f) => f.author_id))];
        const { data: pData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", uids);
        const pMap = new Map(pData?.map((p) => [p.id, p]) ?? []);
        hydrated = hydrated.map((f) => ({
          ...f,
          profiles: pMap.get(f.author_id) ?? null,
        }));
      }

      let myVotes: Record<string, 1 | -1> = {};
      if (authUser && hydrated.length > 0) {
        const { data: votes } = await supabase
          .from("feedback_votes")
          .select("feedback_id, vote")
          .eq("user_id", authUser.id)
          .in(
            "feedback_id",
            hydrated.map((f: any) => f.id),
          );
        for (const v of votes ?? []) myVotes[v.feedback_id] = v.vote;
      }

      setItems(
        hydrated.map(
          (f: any): FeedbackItem => ({ ...f, myVote: myVotes[f.id] ?? null }),
        ),
      );
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();

    // Real-time subscription for new feedback posts
    const stale = supabase
      .getChannels()
      .find((c) => c.topic === "realtime:feedback-feed");
    if (stale) supabase.removeChannel(stale);
    const channel = supabase
      .channel("feedback-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedbacks" },
        async (payload) => {
          const newItem = payload.new as FeedbackItem;
          if (newItem.author_id === myId) return; // already added optimistically via onPosted->load
          const { data: pData } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", newItem.author_id)
            .single();
          setItems((prev) => {
            if (prev.find((f) => f.id === newItem.id)) return prev;
            return [
              { ...newItem, profiles: pData ?? null, myVote: null },
              ...prev,
            ];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, myId]);

  const handleVote = useCallback(
    async (feedbackId: string, vote: 1 | -1) => {
      if (!myId) return;
      const item = itemsRef.current.find((f) => f.id === feedbackId);
      if (!item) return;
      const prevVote = item.myVote;
      const isSame = prevVote === vote;

      setItems((prev) =>
        prev.map((f) => {
          if (f.id !== feedbackId) return f;
          let up = f.upvotes,
            down = f.downvotes;
          if (prevVote === 1) up = Math.max(0, up - 1);
          if (prevVote === -1) down = Math.max(0, down - 1);
          if (!isSame) {
            if (vote === 1) up++;
            else down++;
          }
          return {
            ...f,
            upvotes: up,
            downvotes: down,
            myVote: isSame ? null : vote,
          };
        }),
      );

      if (isSame) {
        await supabase
          .from("feedback_votes")
          .delete()
          .eq("feedback_id", feedbackId)
          .eq("user_id", myId);
      } else {
        await supabase
          .from("feedback_votes")
          .upsert(
            { user_id: myId, feedback_id: feedbackId, vote },
            { onConflict: "user_id,feedback_id" },
          );
      }
    },
    [myId],
  );

  const handleCommentAdded = useCallback((feedbackId: string) => {
    setItems((prev) =>
      prev.map((f) =>
        f.id === feedbackId
          ? { ...f, comments_count: f.comments_count + 1 }
          : f,
      ),
    );
  }, []);

  const handleEdited = useCallback((feedbackId: string, newBody: string) => {
    setItems((prev) =>
      prev.map((f) => (f.id === feedbackId ? { ...f, body: newBody } : f)),
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FeedbackItem }) => (
      <FeedbackCard
        item={item}
        myId={myId}
        theme={theme}
        onVote={handleVote}
        onCommentAdded={handleCommentAdded}
        onEdited={handleEdited}
      />
    ),
    [myId, theme, handleVote, handleCommentAdded, handleEdited],
  );

  return (
    <SafeAreaView
      style={[s.container, { backgroundColor: theme.bg }]}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              s.backBtn,
              { backgroundColor: theme.card, borderColor: PURPLE_BORDER },
            ]}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: theme.text }]}>Campus Voice</Text>
            <View style={s.accentLine} />
          </View>
        </View>

        {/* Table missing warning */}
        {tableError && (
          <View
            style={[
              s.tableBanner,
              { backgroundColor: PURPLE_DIM, borderColor: PURPLE_BORDER },
            ]}
          >
            <Ionicons name="warning-outline" size={16} color={PURPLE} />
            <Text style={[s.tableBannerText, { color: PURPLE }]}>
              Run the feedback migration to activate this feature.
            </Text>
          </View>
        )}

        {/* Feed */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={PURPLE} size="large" />
            <Text style={[s.loadingText, { color: theme.textFaint }]}>
              Scanning transmissions...
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(f) => f.id}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor={PURPLE}
              />
            }
            contentContainerStyle={[
              s.listContent,
              items.length === 0 && { flex: 1 },
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !tableError ? <EmptyState theme={theme} /> : null
            }
          />
        )}

        {/* Compose box */}
        {!tableError && (
          <ComposeBox
            myId={myId}
            theme={theme}
            insetBottom={0}
            onPosted={load}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: PURPLE_BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  title: { fontSize: 20, fontFamily: typography.fontBold, letterSpacing: 0.3 },
  accentLine: {
    marginTop: 4,
    height: 2,
    width: 48,
    borderRadius: 1,
    backgroundColor: PURPLE,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  tableBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  tableBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: typography.fontMedium,
    lineHeight: 17,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 13, fontFamily: typography.fontRegular },
  listContent: { padding: 16, paddingBottom: 8 },
});
