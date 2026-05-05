/**
 * components/feed/PostCard.tsx
 * Renders a single feed post with optimistic like toggle.
 */
import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Share,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { useFeedStore } from '../../store/feedStore'
import type { FeedPost } from '../../lib/feed'

interface PostCardProps {
  post: FeedPost
  onCommentPress?: (postId: string) => void
  onRepostPress?: (post: FeedPost) => void
}

export default function PostCard({ post, onCommentPress, onRepostPress }: PostCardProps) {
  const { toggleLike } = useFeedStore()
  const [sharing, setSharing] = useState(false)

  const isAnon = post.is_anonymous

  const handleLike = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await toggleLike(post.id)
  }

  const handleComment = () => {
    if (onCommentPress) {
      onCommentPress(post.id)
    } else {
      router.push(`/post/${post.id}` as any)
    }
  }

  const handleRepost = () => {
    if (onRepostPress) {
      onRepostPress(post)
    } else {
      Alert.alert('Repost', 'Repost this to your feed?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Repost', onPress: () => {} },
      ])
    }
  }

  const handleShare = async () => {
    if (sharing) return
    setSharing(true)
    try {
      await Share.share({
        message: `${post.body}\n\n— Shared from FAF`,
      })
    } catch {
      // cancelled
    } finally {
      setSharing(false)
    }
  }

  const handleAuthorPress = () => {
    if (!isAnon && post.author_id) {
      router.push(`/profile/${post.author_id}` as any)
    }
  }

  const handleHashtagPress = (tag: string) => {
    router.push(`/hashtag/${tag}` as any)
  }

  const renderBody = (text: string) => {
    const parts = text.split(/(#\w+)/g)
    return (
      <Text style={s.body}>
        {parts.map((part, i) =>
          part.startsWith('#') ? (
            <Text
              key={i}
              style={s.hashtag}
              onPress={() => handleHashtagPress(part.slice(1))}>
              {part}
            </Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    )
  }

  return (
    <View style={s.card}>
      {/* Header */}
      <TouchableOpacity
        style={s.header}
        onPress={handleAuthorPress}
        disabled={isAnon}>
        <View style={s.avatar}>
          {!isAnon && post.profiles?.avatar_url ? (
            <Image source={{ uri: post.profiles.avatar_url }} style={s.avatarImg} />
          ) : (
            <View style={s.avatarFallback}>
              {isAnon ? (
                <Ionicons name="eye-off-outline" size={16} color="rgba(240,240,255,0.5)" />
              ) : (
                <Text style={s.avatarText}>
                  {getInitials(post.profiles?.full_name ?? 'AN')}
                </Text>
              )}
            </View>
          )}
        </View>
        <View style={s.authorInfo}>
          <Text style={s.authorName}>
            {isAnon ? 'Anonymous' : (post.profiles?.full_name ?? 'Unknown')}
          </Text>
          <Text style={s.meta}>
            {getTimeAgo(post.created_at)}
            {!isAnon && post.profiles?.department
              ? ` · ${post.profiles.department}`
              : ''}
          </Text>
        </View>
        {post.post_type === 'club' && (
          <View style={s.typeBadge}>
            <Text style={s.typeText}>Club</Text>
          </View>
        )}
        {post.post_type === 'academic' && (
          <View style={[s.typeBadge, s.typeBadgeAcademic]}>
            <Text style={[s.typeText, { color: '#60a5fa' }]}>Academic</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Body */}
      {renderBody(post.body)}

      {/* Image */}
      {post.image_url ? (
        <Image
          source={{ uri: post.image_url }}
          style={s.media}
          resizeMode="cover"
        />
      ) : null}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <View style={s.tags}>
          {post.tags.map((tag, i) => (
            <TouchableOpacity
              key={i}
              style={s.tag}
              onPress={() => handleHashtagPress(tag)}>
              <Text style={s.tagText}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={handleLike}>
          <Ionicons
            name={post.is_liked ? 'heart' : 'heart-outline'}
            size={16}
            color={post.is_liked ? '#f472b6' : 'rgba(240,240,255,0.4)'}
          />
          <Text style={[s.actionText, post.is_liked && s.likedText]}>
            {post.likes_count}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionBtn} onPress={handleComment}>
          <Ionicons name="chatbubble-outline" size={15} color="rgba(240,240,255,0.4)" />
          <Text style={s.actionText}>{post.comments_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionBtn} onPress={handleRepost}>
          <Ionicons name="repeat-outline" size={16} color="rgba(240,240,255,0.4)" />
          <Text style={s.actionText}>{post.repost_count ?? 0}</Text>
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
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a1e40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c4b5fd',
  },
  authorInfo: { flex: 1 },
  authorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f0f0ff',
    marginBottom: 1,
  },
  meta: {
    fontSize: 10,
    color: 'rgba(240,240,255,0.35)',
  },
  typeBadge: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  typeBadgeAcademic: {
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderColor: 'rgba(96,165,250,0.3)',
  },
  typeText: {
    fontSize: 9,
    color: '#a78bfa',
    fontWeight: '600',
  },
  body: {
    fontSize: 13,
    color: 'rgba(240,240,255,0.8)',
    lineHeight: 20,
    marginBottom: 10,
  },
  hashtag: {
    color: '#a78bfa',
    fontWeight: '500',
  },
  media: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#2a1e40',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tag: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    color: '#a78bfa',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 11,
    color: 'rgba(240,240,255,0.4)',
  },
  likedText: {
    color: '#f472b6',
  },
})
