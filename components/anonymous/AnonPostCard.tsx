/**
 * components/anonymous/AnonPostCard.tsx
 * Anonymous post card — never shows real author info.
 */
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Share, Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { likePost } from '../../lib/feed'
import { getTimeAgo } from '../../lib/matching'
import type { AnonymousPost } from '../../lib/anonymous'
import { useTheme } from '../../lib/theme'

interface AnonPostCardProps {
  post: AnonymousPost
  onCommentPress?: (postId: string) => void
}

export default function AnonPostCard({ post, onCommentPress }: AnonPostCardProps) {
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(post.likes_count)
  const theme = useTheme()

  const handleLike = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikesCount(c => wasLiked ? Math.max(0, c - 1) : c + 1)
    const { data, error } = await likePost(post.id)
    if (error || !data) {
      setLiked(wasLiked)
      setLikesCount(c => wasLiked ? c + 1 : Math.max(0, c - 1))
    }
  }

  const handleShare = async () => {
    await Share.share({ message: `${post.body}\n\n— Posted anonymously on FAF` })
  }

  const renderBody = (text: string | null | undefined) => {
    const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}|\b[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|ng|io|co|me|info|biz|uk|ca|de|jp|fr|au|us|ru|ch|it|nl|se|no|es|mil)\b(?:\/[^\s]*)?|#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/gi
    const parts = (text || '').split(regex)
    return (
      <Text style={[s.body, { color: theme.text }]}>
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

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }, theme.cardShadow]}>
      {/* Header — always anonymous */}
      <View style={s.header}>
        <View style={s.anonAvatar}>
          <Ionicons name="eye-off-outline" size={16} color={theme.textMuted} />
        </View>
        <View>
          <Text style={[s.anonName, { color: theme.text }]}>Anonymous</Text>
          <Text style={[s.time, { color: theme.textFaint }]}>{getTimeAgo(post.created_at)}</Text>
        </View>
      </View>

      {renderBody(post.body)}

      {post.tags && post.tags.length > 0 && (
        <View style={s.tags}>
          {post.tags.map((tag, i) => (
            <TouchableOpacity
              key={i}
              style={[s.tag, { backgroundColor: theme.accentBg }]}
              onPress={() => router.push(`/hashtag/${tag}` as any)}>
              <Text style={[s.tagText, { color: theme.accent }]}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[s.actions, { borderTopColor: theme.border }]}>
        <TouchableOpacity style={s.actionBtn} onPress={handleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={16}
            color={liked ? '#f472b6' : theme.textMuted}
          />
          <Text style={[s.actionText, { color: theme.textMuted }, liked && { color: '#f472b6' }]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.actionBtn}
          onPress={() => onCommentPress?.(post.id)}>
          <Ionicons name="chatbubble-outline" size={15} color={theme.textMuted} />
          <Text style={[s.actionText, { color: theme.textMuted }]}>{post.comments_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16, padding: 14,
    marginHorizontal: 16, marginBottom: 10,
    borderWidth: 0.5,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
  },
  anonAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(244,114,182,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(244,114,182,0.25)',
  },
  anonName: { fontSize: 13, fontWeight: '600', marginBottom: 1 },
  time: { fontSize: 10 },
  body: { fontSize: 14, lineHeight: 21, marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  tagText: { fontSize: 10, fontWeight: '500' },
  actions: {
    flexDirection: 'row', gap: 20,
    paddingTop: 6,
    borderTopWidth: 0.5,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 11 },
})
