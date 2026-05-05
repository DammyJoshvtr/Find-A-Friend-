/**
 * components/anonymous/AnonPostCard.tsx
 * Anonymous post card — never shows real author info.
 */
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Share,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { likePost } from '../../lib/feed'
import { getTimeAgo } from '../../lib/matching'
import type { AnonymousPost } from '../../lib/anonymous'

interface AnonPostCardProps {
  post: AnonymousPost
  onCommentPress?: (postId: string) => void
}

export default function AnonPostCard({ post, onCommentPress }: AnonPostCardProps) {
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(post.likes_count)

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

  return (
    <View style={s.card}>
      {/* Header — always anonymous */}
      <View style={s.header}>
        <View style={s.anonAvatar}>
          <Ionicons name="eye-off-outline" size={16} color="rgba(240,240,255,0.5)" />
        </View>
        <View>
          <Text style={s.anonName}>Anonymous</Text>
          <Text style={s.time}>{getTimeAgo(post.created_at)}</Text>
        </View>
      </View>

      <Text style={s.body}>{post.body}</Text>

      {post.tags && post.tags.length > 0 && (
        <View style={s.tags}>
          {post.tags.map((tag, i) => (
            <TouchableOpacity
              key={i}
              style={s.tag}
              onPress={() => router.push(`/hashtag/${tag}` as any)}>
              <Text style={s.tagText}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={handleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={16}
            color={liked ? '#f472b6' : 'rgba(240,240,255,0.4)'}
          />
          <Text style={[s.actionText, liked && { color: '#f472b6' }]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.actionBtn}
          onPress={() => onCommentPress?.(post.id)}>
          <Ionicons name="chatbubble-outline" size={15} color="rgba(240,240,255,0.4)" />
          <Text style={s.actionText}>{post.comments_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={16} color="rgba(240,240,255,0.4)" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#1c1c2e',
    borderRadius: 16, padding: 14,
    marginHorizontal: 16, marginBottom: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
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
  anonName: { fontSize: 13, fontWeight: '600', color: 'rgba(240,240,255,0.6)', marginBottom: 1 },
  time: { fontSize: 10, color: 'rgba(240,240,255,0.3)' },
  body: { fontSize: 14, color: 'rgba(240,240,255,0.8)', lineHeight: 21, marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  tagText: { fontSize: 10, color: '#a78bfa', fontWeight: '500' },
  actions: {
    flexDirection: 'row', gap: 20,
    paddingTop: 6,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 11, color: 'rgba(240,240,255,0.4)' },
})
