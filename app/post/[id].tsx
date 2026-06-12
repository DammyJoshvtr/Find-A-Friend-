import * as React from 'react'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Alert, Share, Pressable, Linking,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Toast from 'react-native-toast-message'
import { getPost, getComments, commentOnPost, reportPost } from '../../lib/feed'
import { useFeedStore } from '../../store/feedStore'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import type { FeedPost, PostComment } from '../../lib/feed'
import { supabase } from '../../lib/supabase'

function toHandle(name: string | null | undefined) {
  if (!name) return '@user'
  return '@' + name.toLowerCase().replace(/\s+/g, '')
}

function formatFullDate(dateStr: string) {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[date.getMonth()]
  const day = date.getDate()
  const year = date.getFullYear()
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`
}

export default function PostDetailScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { id: rawId } = useLocalSearchParams<{ id: string }>()
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  const [post, setPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<PostComment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [sending, setSending] = useState(false)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const inputRef = useRef<TextInput>(null)

  const {
    toggleLike, toggleBookmark, repostPost,
    incrementCommentCount, likedPostIds, bookmarkedPostIds,
    deletePost,
  } = useFeedStore()

  const isLiked = post ? likedPostIds.has(post.id) : false
  const isBookmarked = post ? bookmarkedPostIds.has(post.id) : false

  const isRepost = !!(post && post.repost_of && post.original_post)
  const orig = post?.original_post
  let quoteText = post?.body ?? ''
  if (isRepost && quoteText.startsWith('[Repost]')) {
    quoteText = ''
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null))
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [postRes, commentsRes] = await Promise.all([getPost(id), getComments(id)])
      setPost(postRes.data)
      setComments(commentsRes.data ?? [])
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }

  const handleLike = () => {
    if (!post) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    toggleLike(post.id)
    setPost(p => p ? {
      ...p,
      likes_count: isLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1,
    } : p)
  }

  const handleBookmark = () => {
    if (!post) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    toggleBookmark(post.id)
  }

  const handleRepost = () => {
    if (!post) return
    Alert.alert('Repost', 'Repost this to your feed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Repost',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          const { error } = await repostPost(post.id)
          if (error) Toast.show({ type: 'error', text1: 'Repost failed', text2: error.message })
          else {
            Toast.show({ type: 'success', text1: 'Reposted!', text2: 'Added to your feed' })
            setPost(p => p ? { ...p, repost_count: (p.repost_count ?? 0) + 1 } : p)
          }
        },
      },
    ])
  }

  const handleShare = async () => {
    if (!post) return
    try { await Share.share({ message: `${post.body}\n\n— via FAF` }) } catch {}
  }

  const handleMore = () => {
    if (!post) return
    const isOwn = myUserId && post.author_id === myUserId
    Alert.alert('Options', undefined, isOwn
      ? [
          {
            text: 'Delete post', style: 'destructive',
            onPress: () =>
              Alert.alert('Delete post', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete', style: 'destructive',
                  onPress: async () => {
                    const { error } = await deletePost(post.id)
                    if (error) Toast.show({ type: 'error', text1: 'Delete failed', text2: error.message })
                    else { Toast.show({ type: 'success', text1: 'Deleted' }); router.back() }
                  },
                },
              ]),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      : [
          {
            text: 'Report post', style: 'destructive',
            onPress: () =>
              Alert.alert('Report post', 'Report this as inappropriate?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Report', style: 'destructive',
                  onPress: async () => {
                    const { error } = await reportPost(post.id)
                    if (error) Toast.show({ type: 'error', text1: 'Report failed', text2: error.message })
                    else Toast.show({ type: 'success', text1: 'Reported', text2: 'Thanks for keeping FAF safe' })
                  },
                },
              ]),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
    )
  }

  const handleSend = async () => {
    const trimmed = commentText.trim()
    if (!trimmed || sending || !post) return
    setSending(true)
    const { data, error } = await commentOnPost(post.id, trimmed)
    if (!error && data) {
      setComments(prev => [...prev, data])
      incrementCommentCount(post.id)
      setPost(p => p ? { ...p, comments_count: p.comments_count + 1 } : p)
      setCommentText('')
    }
    setSending(false)
  }

  const renderBody = (text: string | null | undefined, isRepostText = false) => {
    const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}|\b[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|ng|io|co|me|info|biz|uk|ca|de|jp|fr|au|us|ru|ch|it|nl|se|no|es|mil)\b(?:\/[^\s]*)?|#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/gi
    const parts = (text || '').split(regex)
    return (
      <Text style={[isRepostText ? s.repostBody : s.postBody, { color: theme.text }]}>
        {parts.map((part, i) => {
          if (part.startsWith('#'))
            return <Text key={i} style={{ color: theme.accent }} onPress={() => router.push(`/hashtag/${part.slice(1)}` as any)}>{part}</Text>
          if (part.startsWith('@'))
            return <Text key={i} style={{ color: theme.accent }}>{part}</Text>
          if (part.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/i)) {
            return (
              <Text
                key={i}
                style={{ color: theme.accent, textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL(`mailto:${part}`).catch(() => {})}
              >
                {part}
              </Text>
            )
          }
          if (part.match(/^https?:\/\//i) || part.match(/^www\./i) || part.match(/^[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|ng|io|co|me|info|biz|uk|ca|de|jp|fr|au|us|ru|ch|it|nl|se|no|es|mil)/i)) {
            const url = part.match(/^https?:\/\//i) ? part : `https://${part}`
            return (
              <Text
                key={i}
                style={{ color: theme.accent, textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL(url).catch(() => {})}
              >
                {part}
              </Text>
            )
          }
          return <Text key={i}>{part}</Text>
        })}
      </Text>
    )
  }

  const renderCommentBody = (text: string | null | undefined) => {
    const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}|\b[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|ng|io|co|me|info|biz|uk|ca|de|jp|fr|au|us|ru|ch|it|nl|se|no|es|mil)\b(?:\/[^\s]*)?|#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/gi
    const parts = (text || '').split(regex)
    return (
      <Text style={[s.commentBody, { color: theme.textMuted }]}>
        {parts.map((part, i) => {
          if (part.startsWith('#'))
            return <Text key={i} style={{ color: theme.accent }} onPress={() => router.push(`/hashtag/${part.slice(1)}` as any)}>{part}</Text>
          if (part.startsWith('@'))
            return <Text key={i} style={{ color: theme.accent }}>{part}</Text>
          if (part.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/i)) {
            return (
              <Text
                key={i}
                style={{ color: theme.accent, textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL(`mailto:${part}`).catch(() => {})}
              >
                {part}
              </Text>
            )
          }
          if (part.match(/^https?:\/\//i) || part.match(/^www\./i) || part.match(/^[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|ng|io|co|me|info|biz|uk|ca|de|jp|fr|au|us|ru|ch|it|nl|se|no|es|mil)/i)) {
            const url = part.match(/^https?:\/\//i) ? part : `https://${part}`
            return (
              <Text
                key={i}
                style={{ color: theme.accent, textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL(url).catch(() => {})}
              >
                {part}
              </Text>
            )
          }
          return <Text key={i}>{part}</Text>
        })}
      </Text>
    )
  }

  const renderComment = useCallback(({ item }: { item: PostComment }) => {
    const name = item.is_anonymous ? 'Anonymous' : (item.profiles?.full_name ?? 'User')
    const initials = item.is_anonymous ? '?' : getInitials(item.profiles?.full_name ?? '?')
    return (
      <View style={[s.commentRow, { borderBottomColor: theme.border }]}>
        <View style={[s.commentAvatar, { backgroundColor: theme.cardSolid, borderColor: theme.border }]}>
          {!item.is_anonymous && item.profiles?.avatar_url
            ? <Image source={{ uri: item.profiles.avatar_url }} style={s.commentAvatarImg} />
            : <Text style={[s.commentInitials, { color: theme.accent }]}>{initials}</Text>}
        </View>
        <View style={s.commentContent}>
          <View style={s.commentMeta}>
            <Text style={[s.commentName, { color: theme.text }]}>{name}</Text>
            <Text style={[s.commentTime, { color: theme.textFaint }]}>{getTimeAgo(item.created_at)}</Text>
          </View>
          {renderCommentBody(item.body)}
        </View>
      </View>
    )
  }, [theme])

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    )
  }

  if (!post) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.loadingWrap}>
          <Text style={[s.errorText, { color: theme.textMuted }]}>Post not found.</Text>
          <TouchableOpacity style={[s.pill, { backgroundColor: theme.accent }]} onPress={() => router.back()}>
            <Text style={s.pillText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const isAnon = post.is_anonymous
  const displayName = isAnon ? 'Anonymous' : (post.profiles?.full_name ?? 'User')
  const handle = isAnon ? '@anonymous' : toHandle(post.profiles?.full_name)
  const goToProfile = () => !isAnon && post.author_id && router.push(`/profile/${post.author_id}` as any)

  const handleOrigPress = () => {
    if (orig) {
      router.push(`/post/${orig.id}` as any)
    }
  }

  const PostHeader = (
    <View>
      {isRepost && (
        <View style={s.repostHeaderRow}>
          <Ionicons name="repeat-outline" size={14} color={theme.textMuted} />
          <Text style={[s.repostHeaderText, { color: theme.textMuted }]}>
            {displayName} reposted
          </Text>
        </View>
      )}

      {/* ── Author row ── */}
      <View style={[s.authorSection, { borderBottomColor: theme.border }, isRepost && { paddingTop: 6 }]}>
        <TouchableOpacity onPress={goToProfile} disabled={isAnon}
          style={[s.avatarRing, { borderColor: isAnon ? theme.border : theme.accentBorder }]}>
          {!isAnon && post.profiles?.avatar_url
            ? <Image source={{ uri: post.profiles.avatar_url }} style={s.avatar} />
            : <View style={[s.avatarFallback, { backgroundColor: theme.cardSolid }]}>
                {isAnon
                  ? <Ionicons name="eye-off-outline" size={18} color={theme.textMuted} />
                  : <Text style={[s.avatarInitials, { color: theme.accent }]}>{getInitials(post.profiles?.full_name ?? 'U')}</Text>}
              </View>}
        </TouchableOpacity>

        <TouchableOpacity style={{ flex: 1 }} onPress={goToProfile} disabled={isAnon}>
          <Text style={[s.authorName, { color: theme.text }]}>{displayName}</Text>
          <Text style={[s.authorHandle, { color: theme.textMuted }]}>{handle}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleMore} hitSlop={12}
          style={[s.moreBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="ellipsis-horizontal" size={16} color={theme.textFaint} />
        </TouchableOpacity>
      </View>

      {/* ── Body ── */}
      <View style={s.bodySection}>
        {quoteText ? renderBody(quoteText) : null}
        {post.image_url && !isRepost
          ? <Image source={{ uri: post.image_url }} style={[s.postImage, { borderColor: theme.border }]} resizeMode="cover" />
          : null}

        {/* Nested original post card (X/Twitter Quote style) */}
        {isRepost && orig ? (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[s.repostCard, { borderColor: theme.border, backgroundColor: 'rgba(255, 255, 255, 0.015)' }]}
            onPress={handleOrigPress}
          >
            <View style={s.repostCardHeader}>
              <View style={[s.repostAvatarRing, { borderColor: orig.is_anonymous ? theme.border : theme.accentBorder }]}>
                {!orig.is_anonymous && orig.profiles?.avatar_url ? (
                  <Image source={{ uri: orig.profiles.avatar_url }} style={s.repostAvatar} />
                ) : (
                  <View style={[s.repostAvatarFallback, { backgroundColor: theme.cardSolid }]}>
                    {orig.is_anonymous ? (
                      <Ionicons name="eye-off-outline" size={10} color={theme.textMuted} />
                    ) : (
                      <Text style={[s.repostAvatarText, { color: theme.accent }]}>
                        {getInitials(orig.profiles?.full_name ?? 'U')}
                      </Text>
                    )}
                  </View>
                )}
              </View>
              <View style={s.repostMetaRow}>
                <Text style={[s.repostAuthorName, { color: theme.text }]} numberOfLines={1}>
                  {orig.is_anonymous ? 'Anonymous' : (orig.profiles?.full_name ?? 'User')}
                </Text>
                <Text style={[s.repostAuthorHandle, { color: theme.textMuted }]} numberOfLines={1}>
                  {orig.is_anonymous ? '@anonymous' : toHandle(orig.profiles?.full_name)}
                </Text>
                <Text style={[s.repostAuthorHandle, { color: theme.textFaint }]}>
                  · {getTimeAgo(orig.created_at)}
                </Text>
              </View>
            </View>
            {orig.body ? renderBody(orig.body, true) : null}
            {orig.image_url ? (
              <Image
                source={{ uri: orig.image_url }}
                style={[s.repostMedia, { borderColor: theme.border }]}
                resizeMode="cover"
              />
            ) : null}
          </TouchableOpacity>
        ) : null}

        <Text style={[s.timestamp, { color: theme.textFaint }]}>{formatFullDate(post.created_at)}</Text>
      </View>

      {/* ── Stats row ── */}
      {(post.likes_count > 0 || (post.repost_count ?? 0) > 0 || post.comments_count > 0) && (
        <View style={[s.statsRow, { borderColor: theme.border }]}>
          {post.comments_count > 0 && (
            <Text style={s.statItem}>
              <Text style={[s.statNum, { color: theme.text }]}>{post.comments_count}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}> {post.comments_count === 1 ? 'Reply' : 'Replies'}</Text>
            </Text>
          )}
          {(post.repost_count ?? 0) > 0 && (
            <Text style={s.statItem}>
              <Text style={[s.statNum, { color: theme.text }]}>{post.repost_count}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}> {post.repost_count === 1 ? 'Repost' : 'Reposts'}</Text>
            </Text>
          )}
          {post.likes_count > 0 && (
            <Text style={s.statItem}>
              <Text style={[s.statNum, { color: theme.text }]}>{post.likes_count}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}> {post.likes_count === 1 ? 'Like' : 'Likes'}</Text>
            </Text>
          )}
        </View>
      )}

      {/* ── Action bar ── */}
      <View style={[s.actionBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={s.actionBtn} onPress={() => inputRef.current?.focus()} hitSlop={10}>
          <Ionicons name="chatbubble-outline" size={22} color={theme.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={handleRepost} hitSlop={10}>
          <Ionicons name="repeat-outline" size={22} color={theme.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={handleLike} hitSlop={10}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={22}
            color={isLiked ? '#f472b6' : theme.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={handleBookmark} hitSlop={10}>
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={isBookmarked ? theme.accent : theme.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={handleShare} hitSlop={10}>
          <Ionicons name="share-outline" size={22} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ── Replies label ── */}
      <View style={[s.repliesLabel, { borderBottomColor: theme.border }]}>
        <Text style={[s.repliesText, { color: theme.textMuted }]}>
          {comments.length} {comments.length === 1 ? 'Reply' : 'Replies'}
        </Text>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* ── Header ── */}
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()}
            style={[s.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="arrow-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: theme.text }]}>Post</Text>
          <View style={{ width: 36 }} />
        </View>

        <FlatList
          data={comments}
          keyExtractor={item => item.id}
          renderItem={renderComment}
          ListHeaderComponent={PostHeader}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="chatbubble-outline" size={36} color={theme.textFaint} />
              <Text style={[s.emptyTitle, { color: theme.textMuted }]}>No replies yet</Text>
              <Text style={[s.emptyHint, { color: theme.textFaint }]}>Be the first to reply</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* ── Reply input ── */}
        <View style={[s.inputRow, { borderTopColor: theme.border, paddingBottom: insets.bottom + 4 }]}>
          <TextInput
            ref={inputRef}
            style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="Post your reply…"
            placeholderTextColor={theme.textFaint}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: theme.accent }, (!commentText.trim() || sending) && s.sendDisabled]}
            onPress={handleSend}
            disabled={!commentText.trim() || sending}>
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, fontFamily: typography.fontRegular },

  /* Quote Repost Styles */
  repostCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  repostCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  repostAvatarRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    padding: 1,
  },
  repostAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  repostAvatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repostAvatarText: {
    fontSize: 8,
    fontFamily: typography.fontBold,
  },
  repostMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 4,
  },
  repostAuthorName: {
    fontSize: 13,
    fontFamily: typography.fontBold,
  },
  repostAuthorHandle: {
    fontSize: 12,
    fontFamily: typography.fontRegular,
  },
  repostBody: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontRegular,
  },
  repostMedia: {
    width: '100%',
    height: 160,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
  },
  repostHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  repostHeaderText: {
    fontSize: 12,
    fontFamily: typography.fontMedium,
  },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5,
  },
  headerTitle: { fontSize: 15, fontFamily: typography.fontSemiBold },
  pill: { borderRadius: 20, paddingHorizontal: 22, paddingVertical: 10 },
  pillText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  /* Author */
  authorSection: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 0.5,
  },
  avatarRing: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.5, padding: 2,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 22 },
  avatarFallback: {
    width: '100%', height: '100%', borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 14, fontFamily: typography.fontBold },
  authorName: { fontSize: 15, fontFamily: typography.fontBold },
  authorHandle: { fontSize: 13, fontFamily: typography.fontRegular, marginTop: 1 },
  moreBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5,
  },

  /* Body */
  bodySection: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  postBody: { fontSize: 18, lineHeight: 28, fontFamily: typography.fontRegular, marginBottom: 12 },
  postImage: {
    width: '100%', height: 240, borderRadius: 16,
    borderWidth: 1, marginBottom: 12,
  },
  timestamp: { fontSize: 13, fontFamily: typography.fontRegular, paddingBottom: 14 },

  /* Stats */
  statsRow: {
    flexDirection: 'row', gap: 20,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 0.5, borderBottomWidth: 0.5,
  },
  statItem: {},
  statNum: { fontSize: 15, fontFamily: typography.fontBold },
  statLabel: { fontSize: 14, fontFamily: typography.fontRegular },

  /* Action bar */
  actionBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 6, borderBottomWidth: 0.5,
  },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10,
  },

  /* Replies label */
  repliesLabel: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
  repliesText: { fontSize: 12, fontFamily: typography.fontMedium, textTransform: 'uppercase', letterSpacing: 0.5 },

  /* Comment rows */
  commentRow: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  commentAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, flexShrink: 0, overflow: 'hidden',
  },
  commentAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  commentInitials: { fontSize: 11, fontFamily: typography.fontBold },
  commentContent: { flex: 1 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  commentName: { fontSize: 13, fontFamily: typography.fontSemiBold },
  commentTime: { fontSize: 11, fontFamily: typography.fontRegular },
  commentBody: { fontSize: 14, lineHeight: 20, fontFamily: typography.fontRegular },

  /* Empty */
  emptyWrap: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: typography.fontSemiBold },
  emptyHint: { fontSize: 13, fontFamily: typography.fontRegular },

  /* Input */
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 8,
    borderTopWidth: 0.5,
  },
  input: {
    flex: 1, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, fontFamily: typography.fontRegular,
    maxHeight: 100, borderWidth: 0.5,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
})
