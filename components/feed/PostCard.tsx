import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Modal, Share, Pressable, Alert, Platform,
} from 'react-native'
import Toast from 'react-native-toast-message'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { useFeedStore } from '../../store/feedStore'
import { supabase } from '../../lib/supabase'
import { reportPost } from '../../lib/feed'
import { useTheme, glowShadow } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { createStory } from '../../lib/stories'
import type { FeedPost } from '../../lib/feed'

interface PostCardProps {
  post: FeedPost
}

function toHandle(name: string | null | undefined): string {
  if (!name) return '@user'
  return '@' + name.toLowerCase().replace(/\s+/g, '')
}

export default function PostCard({ post }: PostCardProps) {
  const { toggleLike, toggleBookmark, repostPost, deletePost } = useFeedStore()
  const [imageOpen, setImageOpen] = useState(false)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const theme = useTheme()

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null))
  }, [])

  const isAnon = post.is_anonymous
  const displayName = isAnon ? 'Anonymous' : (post.profiles?.full_name ?? 'User')
  const handle = isAnon ? '@anonymous' : toHandle(post.profiles?.full_name)

  const handleLike = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleLike(post.id) }
  const handleBookmark = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleBookmark(post.id) }
  const handleComment = () => router.push(`/post/${post.id}` as any)
  const handleRepost = () => {
    Alert.alert('Repost', 'Repost this to your feed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Repost',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          const { error } = await repostPost(post.id)
          if (error) Toast.show({ type: 'error', text1: 'Repost failed', text2: error.message })
          else Toast.show({ type: 'success', text1: 'Reposted!', text2: 'Added to your feed' })
        },
      },
    ])
  }
  const handleAddToStory = async () => {
    if (post.image_url) {
      const { error } = await createStory({
        mediaUrl: post.image_url,
        mediaType: 'image',
        caption: post.body?.slice(0, 150),
        durationSecs: 5,
      })
      if (error) Toast.show({ type: 'error', text1: 'Error', text2: error.message })
      else Toast.show({ type: 'success', text1: 'Added!', text2: 'Post shared to your story' })
    } else {
      router.push('/create-story' as any)
    }
  }
  const handleShare = () => {
    Alert.alert('Share', undefined, [
      { text: 'Add to Story', onPress: handleAddToStory },
      {
        text: 'Share externally', onPress: async () => {
          try { await Share.share({ message: `${post.body}\n\n— via FAF` }) } catch {}
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }
  const handleMore = () => {
    const isOwn = myUserId && post.author_id === myUserId
    Alert.alert('Options', undefined, isOwn
      ? [
          {
            text: 'Delete post', style: 'destructive',
            onPress: () => {
              Alert.alert('Delete post', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete', style: 'destructive',
                  onPress: async () => {
                    const { error } = await deletePost(post.id)
                    if (error) Toast.show({ type: 'error', text1: 'Delete failed', text2: error.message })
                    else Toast.show({ type: 'success', text1: 'Deleted', text2: 'Your post was removed' })
                  },
                },
              ])
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      : [
          {
            text: 'Report post', style: 'destructive',
            onPress: () => {
              Alert.alert('Report post', 'Report this content as inappropriate?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Report', style: 'destructive',
                  onPress: async () => {
                    const { error } = await reportPost(post.id)
                    if (error) Toast.show({ type: 'error', text1: 'Report failed', text2: error.message })
                    else Toast.show({ type: 'success', text1: 'Reported', text2: 'Thanks for keeping FAF safe' })
                  },
                },
              ])
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
    )
  }
  const handleAuthorPress = () => {
    if (!isAnon && post.author_id) router.push(`/profile/${post.author_id}` as any)
  }

  const renderBody = (text: string) => {
    const parts = text.split(/([@#]\w+)/g)
    return (
      <Text style={[s.body, { color: theme.text }]}>
        {parts.map((part, i) => {
          if (part.startsWith('#'))
            return <Text key={i} style={{ color: theme.accent }} onPress={() => router.push(`/hashtag/${part.slice(1)}` as any)}>{part}</Text>
          if (part.startsWith('@'))
            return <Text key={i} style={{ color: theme.accent }}>{part}</Text>
          return <Text key={i}>{part}</Text>
        })}
      </Text>
    )
  }

  return (
    <Pressable
      style={[s.card, { borderColor: theme.border, backgroundColor: theme.card }]}
      onPress={() => router.push(`/post/${post.id}` as any)}
      android_ripple={{ color: 'rgba(167,139,250,0.08)' }}
    >
      {/* Subtle top-edge tint */}
      <View style={s.cardGradient} pointerEvents="none" />

      <View style={s.row}>
        {/* Avatar with accent ring */}
        <TouchableOpacity onPress={handleAuthorPress} disabled={isAnon} style={s.avatarCol}>
          <View style={[s.avatarRing, { borderColor: isAnon ? theme.border : theme.accentBorder }]}>
            {!isAnon && post.profiles?.avatar_url ? (
              <Image source={{ uri: post.profiles.avatar_url }} style={s.avatar} />
            ) : (
              <View style={[s.avatarFallback, { backgroundColor: theme.cardSolid }]}>
                {isAnon
                  ? <Ionicons name="eye-off-outline" size={17} color={theme.textMuted} />
                  : <Text style={s.avatarText}>{getInitials(post.profiles?.full_name ?? 'U')}</Text>
                }
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={s.content}>
          {/* Author row */}
          <View style={s.authorRow}>
            <TouchableOpacity onPress={handleAuthorPress} disabled={isAnon} style={{ flex: 1 }}>
              <View style={s.nameRow}>
                <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
                {post.post_type === 'academic' && (
                  <View style={s.badge}><Text style={s.badgeText}>Academic</Text></View>
                )}
                {post.post_type === 'club' && (
                  <View style={[s.badge, s.badgeClub]}><Text style={[s.badgeText, { color: theme.accent }]}>Club</Text></View>
                )}
              </View>
              <Text style={[s.meta, { color: theme.textMuted }]} numberOfLines={1}>
                {handle} · {getTimeAgo(post.created_at)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleMore} style={s.moreBtn} hitSlop={12}>
              <Ionicons name="ellipsis-horizontal" size={16} color={theme.textFaint} />
            </TouchableOpacity>
          </View>

          {renderBody(post.body)}

          {/* Media with accent border */}
          {post.image_url ? (
            <TouchableOpacity onPress={() => setImageOpen(true)} activeOpacity={0.95}>
              <Image
                source={{ uri: post.image_url }}
                style={[s.media, { borderColor: theme.border }]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : null}

          {/* Action row */}
          <View style={s.actions}>
            <Action icon="chatbubble-outline" count={post.comments_count} onPress={handleComment} activeColor={theme.cyan} />
            <Action icon="repeat-outline" count={post.repost_count ?? 0} onPress={handleRepost} activeColor="#34d399" />
            <Action icon={post.is_liked ? 'heart' : 'heart-outline'} count={post.likes_count} onPress={handleLike} active={post.is_liked} activeColor="#f472b6" inactiveColor={theme.textMuted} />
            <Action icon={post.is_bookmarked ? 'bookmark' : 'bookmark-outline'} onPress={handleBookmark} active={post.is_bookmarked} activeColor={theme.accent} inactiveColor={theme.textMuted} />
            <Action icon="share-outline" onPress={handleShare} activeColor={theme.accent} inactiveColor={theme.textMuted} />
          </View>
        </View>
      </View>

      {post.image_url ? (
        <Modal visible={imageOpen} transparent animationType="fade">
          <Pressable style={s.imgModal} onPress={() => setImageOpen(false)}>
            <Image source={{ uri: post.image_url }} style={s.imgModalImg} resizeMode="contain" />
          </Pressable>
        </Modal>
      ) : null}
    </Pressable>
  )
}

interface ActionProps {
  icon: string; count?: number; onPress: () => void
  active?: boolean; activeColor?: string; inactiveColor?: string
}

function Action({ icon, count, onPress, active, activeColor = '#a78bfa', inactiveColor = 'rgba(240,240,255,0.3)' }: ActionProps) {
  return (
    <TouchableOpacity style={s.actionBtn} onPress={onPress} hitSlop={12}>
      <View style={active ? [s.activeIconWrap, { shadowColor: activeColor }] : null}>
        <Ionicons name={icon as any} size={17} color={active ? activeColor : inactiveColor} />
      </View>
      {count !== undefined && count > 0 ? (
        <Text style={[s.actionCount, { color: active ? activeColor : inactiveColor }]}>
          {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
        </Text>
      ) : null}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardGradient: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 60,
    backgroundColor: 'rgba(167,139,250,0.05)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  row: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  avatarCol: { marginRight: 12, paddingTop: 2 },
  avatarRing: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1.5, padding: 1.5,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 21 },
  avatarFallback: {
    width: '100%', height: '100%', borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontFamily: typography.fontBold, color: '#c4b5fd' },
  content: { flex: 1, paddingBottom: 10 },
  authorRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontFamily: typography.fontBold },
  badge: {
    backgroundColor: 'rgba(96,165,250,0.12)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 0.5, borderColor: 'rgba(96,165,250,0.25)',
  },
  badgeClub: { backgroundColor: 'rgba(167,139,250,0.1)', borderColor: 'rgba(167,139,250,0.25)' },
  badgeText: { fontSize: 9, fontFamily: typography.fontSemiBold, color: '#60a5fa' },
  meta: { fontSize: 12, fontFamily: typography.fontRegular, marginTop: 1 },
  moreBtn: { padding: 4, marginLeft: 4 },
  body: { fontSize: 14, lineHeight: 22, fontFamily: typography.fontRegular, marginBottom: 10 },
  media: {
    width: '100%', height: 220,
    borderRadius: 14, marginBottom: 10,
    borderWidth: 1,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingRight: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 36 },
  actionCount: { fontSize: 12 },
  activeIconWrap: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  imgModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  imgModalImg: { width: '100%', height: '80%' },
})
