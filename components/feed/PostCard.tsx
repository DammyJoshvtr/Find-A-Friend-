import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Modal, Share, Pressable, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { useFeedStore } from '../../store/feedStore'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/theme'
import type { FeedPost } from '../../lib/feed'

interface PostCardProps {
  post: FeedPost
  onCommentPress?: (postId: string) => void
}

function toHandle(name: string | null | undefined): string {
  if (!name) return '@user'
  return '@' + name.toLowerCase().replace(/\s+/g, '')
}

export default function PostCard({ post, onCommentPress }: PostCardProps) {
  const { toggleLike, toggleBookmark } = useFeedStore()
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
  const handleComment = () => { onCommentPress ? onCommentPress(post.id) : router.push(`/post/${post.id}` as any) }
  const handleRepost = () => {
    Alert.alert('Repost', 'Repost this to your feed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Repost', onPress: () => {} },
    ])
  }
  const handleShare = async () => {
    try { await Share.share({ message: `${post.body}\n\n— via FAF` }) } catch {}
  }
  const handleMore = () => {
    const isOwn = myUserId && post.author_id === myUserId
    Alert.alert('Options', undefined, isOwn
      ? [{ text: 'Delete post', style: 'destructive', onPress: () => {} }, { text: 'Cancel', style: 'cancel' }]
      : [{ text: 'Report post', style: 'destructive', onPress: () => {} }, { text: 'Cancel', style: 'cancel' }]
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
    <View style={[s.row, { borderBottomColor: theme.border }]}>
      <TouchableOpacity onPress={handleAuthorPress} disabled={isAnon} style={s.avatarCol}>
        {!isAnon && post.profiles?.avatar_url ? (
          <Image source={{ uri: post.profiles.avatar_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatarFallback, { backgroundColor: theme.card2 }]}>
            {isAnon
              ? <Ionicons name="eye-off-outline" size={17} color={theme.textMuted} />
              : <Text style={s.avatarText}>{getInitials(post.profiles?.full_name ?? 'U')}</Text>
            }
          </View>
        )}
      </TouchableOpacity>

      <View style={s.content}>
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
          <TouchableOpacity onPress={handleMore} style={s.moreBtn} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={16} color={theme.textFaint} />
          </TouchableOpacity>
        </View>

        {renderBody(post.body)}

        {post.image_url ? (
          <TouchableOpacity onPress={() => setImageOpen(true)} activeOpacity={0.95}>
            <Image source={{ uri: post.image_url }} style={[s.media, { backgroundColor: theme.card }]} resizeMode="cover" />
          </TouchableOpacity>
        ) : null}

        <View style={s.actions}>
          <Action icon="chatbubble-outline" count={post.comments_count} onPress={handleComment} activeColor={theme.accent} />
          <Action icon="repeat-outline" count={post.repost_count ?? 0} onPress={handleRepost} activeColor="#34d399" />
          <Action icon={post.is_liked ? 'heart' : 'heart-outline'} count={post.likes_count} onPress={handleLike} active={post.is_liked} activeColor="#f472b6" inactiveColor={theme.textMuted} />
          <Action icon={post.is_bookmarked ? 'bookmark' : 'bookmark-outline'} onPress={handleBookmark} active={post.is_bookmarked} activeColor={theme.accent} inactiveColor={theme.textMuted} />
          <Action icon="share-outline" onPress={handleShare} activeColor={theme.accent} inactiveColor={theme.textMuted} />
        </View>
      </View>

      {post.image_url ? (
        <Modal visible={imageOpen} transparent animationType="fade">
          <Pressable style={s.imgModal} onPress={() => setImageOpen(false)}>
            <Image source={{ uri: post.image_url }} style={s.imgModalImg} resizeMode="contain" />
          </Pressable>
        </Modal>
      ) : null}
    </View>
  )
}

interface ActionProps {
  icon: string; count?: number; onPress: () => void
  active?: boolean; activeColor?: string; inactiveColor?: string
}

function Action({ icon, count, onPress, active, activeColor = '#a78bfa', inactiveColor = 'rgba(240,240,255,0.35)' }: ActionProps) {
  return (
    <TouchableOpacity style={s.actionBtn} onPress={onPress} hitSlop={6}>
      <Ionicons name={icon as any} size={17} color={active ? activeColor : inactiveColor} />
      {count !== undefined && count > 0 ? (
        <Text style={[s.actionCount, { color: active ? activeColor : inactiveColor }]}>
          {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
        </Text>
      ) : null}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2, borderBottomWidth: 0.5 },
  avatarCol: { marginRight: 12, paddingTop: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#c4b5fd' },
  content: { flex: 1, paddingBottom: 10 },
  authorRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700' },
  badge: {
    backgroundColor: 'rgba(96,165,250,0.12)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 0.5, borderColor: 'rgba(96,165,250,0.25)',
  },
  badgeClub: { backgroundColor: 'rgba(167,139,250,0.1)', borderColor: 'rgba(167,139,250,0.25)' },
  badgeText: { fontSize: 9, fontWeight: '600', color: '#60a5fa' },
  meta: { fontSize: 13, marginTop: 1 },
  moreBtn: { padding: 4, marginLeft: 4 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
  media: { width: '100%', height: 220, borderRadius: 14, marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingRight: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 36 },
  actionCount: { fontSize: 12 },
  imgModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', alignItems: 'center', justifyContent: 'center' },
  imgModalImg: { width: '100%', height: '80%' },
})
