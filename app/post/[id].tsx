/**
 * app/post/[id].tsx
 * Single post detail screen — full post + comments.
 */
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getPost, getComments, commentOnPost } from '../../lib/feed'
import { useFeedStore } from '../../store/feedStore'
import { getInitials, getTimeAgo } from '../../lib/matching'
import PostCard from '../../components/feed/PostCard'
import type { FeedPost, PostComment } from '../../lib/feed'

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [post, setPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<PostComment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [sending, setSending] = useState(false)
  const { incrementCommentCount } = useFeedStore()

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    const [postRes, commentsRes] = await Promise.all([
      getPost(id),
      getComments(id),
    ])
    setPost(postRes.data)
    setComments(commentsRes.data ?? [])
    setLoading(false)
  }

  const handleSend = async () => {
    const trimmed = commentText.trim()
    if (!trimmed || sending) return
    setSending(true)
    const { data, error } = await commentOnPost(id, trimmed)
    if (!error && data) {
      setComments(prev => [...prev, data])
      incrementCommentCount(id)
      setCommentText('')
    }
    setSending(false)
  }

  const renderComment = ({ item }: { item: PostComment }) => (
    <View style={s.commentRow}>
      <View style={s.avatar}>
        {item.profiles?.avatar_url ? (
          <Image source={{ uri: item.profiles.avatar_url }} style={s.avatarImg} />
        ) : (
          <Text style={s.initials}>
            {item.is_anonymous ? '?' : getInitials(item.profiles?.full_name ?? '??')}
          </Text>
        )}
      </View>
      <View style={s.commentContent}>
        <Text style={s.commentAuthor}>
          {item.is_anonymous ? 'Anonymous' : (item.profiles?.full_name ?? 'User')}
        </Text>
        <Text style={s.commentBody}>{item.body}</Text>
        <Text style={s.commentTime}>{getTimeAgo(item.created_at)}</Text>
      </View>
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      </SafeAreaView>
    )
  }

  if (!post) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>Post not found.</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backIcon}>
            <Ionicons name="arrow-back" size={22} color="#f0f0ff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Post</Text>
          <View style={{ width: 36 }} />
        </View>

        <FlatList
          data={comments}
          keyExtractor={item => item.id}
          renderItem={renderComment}
          ListHeaderComponent={
            <View style={{ paddingBottom: 8 }}>
              <PostCard post={post} />
              <View style={s.divider}>
                <Text style={s.dividerText}>
                  {comments.length} comment{comments.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={s.emptyComments}>
              <Ionicons name="chatbubble-outline" size={28} color="rgba(240,240,255,0.15)" />
              <Text style={s.emptyText}>No comments yet</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        />

        {/* Input */}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Add a comment..."
            placeholderTextColor="rgba(240,240,255,0.3)"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!commentText.trim() || sending) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!commentText.trim() || sending}>
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1c1c2e',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  backBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  backBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  divider: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  dividerText: { fontSize: 12, color: 'rgba(240,240,255,0.35)', fontWeight: '500' },
  commentRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2a1e40',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  initials: { fontSize: 10, fontWeight: '700', color: '#c4b5fd' },
  commentContent: { flex: 1 },
  commentAuthor: { fontSize: 12, fontWeight: '600', color: '#f0f0ff', marginBottom: 2 },
  commentBody: { fontSize: 13, color: 'rgba(240,240,255,0.75)', lineHeight: 18, marginBottom: 2 },
  commentTime: { fontSize: 10, color: 'rgba(240,240,255,0.3)' },
  emptyComments: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.3)' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0d0d14',
  },
  input: {
    flex: 1,
    backgroundColor: '#1c1c2e',
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, color: '#f0f0ff',
    maxHeight: 100,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#a78bfa',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
})
