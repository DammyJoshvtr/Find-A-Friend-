/**
 * components/feed/CommentSheet.tsx
 * Bottom sheet showing post comments + inline reply input.
 */
import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getComments, commentOnPost } from '../../lib/feed'
import { useFeedStore } from '../../store/feedStore'
import { getInitials, getTimeAgo } from '../../lib/matching'
import type { PostComment } from '../../lib/feed'

interface CommentSheetProps {
  postId: string
  visible: boolean
  onClose: () => void
}

export default function CommentSheet({ postId, visible, onClose }: CommentSheetProps) {
  const [comments, setComments] = useState<PostComment[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const { incrementCommentCount } = useFeedStore()

  useEffect(() => {
    if (visible && postId) {
      loadComments()
    }
  }, [visible, postId])

  const loadComments = async () => {
    setLoading(true)
    const { data } = await getComments(postId)
    setComments(data ?? [])
    setLoading(false)
  }

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    const { data, error } = await commentOnPost(postId, trimmed)
    if (!error && data) {
      setComments(prev => [...prev, data])
      incrementCommentCount(postId)
      setText('')
    }
    setSending(false)
  }

  const renderComment = ({ item }: { item: PostComment }) => (
    <View style={s.commentRow}>
      <View style={s.commentAvatar}>
        {item.profiles?.avatar_url ? (
          <Image source={{ uri: item.profiles.avatar_url }} style={s.commentAvatarImg} />
        ) : (
          <Text style={s.commentInitials}>
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.sheet}>
          <View style={s.handle} />
          <View style={s.sheetHeader}>
            <Text style={s.title}>Comments</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(240,240,255,0.5)" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              color="#a78bfa"
              style={{ marginVertical: 30 }}
            />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={item => item.id}
              renderItem={renderComment}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Ionicons name="chatbubble-outline" size={32} color="rgba(240,240,255,0.2)" />
                  <Text style={s.emptyText}>No comments yet. Be first!</Text>
                </View>
              }
              style={s.list}
              contentContainerStyle={{ paddingBottom: 8 }}
            />
          )}

          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder="Add a comment..."
              placeholderTextColor="rgba(240,240,255,0.3)"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}>
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1c1c2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: 300,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f0f0ff',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a1e40',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  commentAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentInitials: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c4b5fd',
  },
  commentContent: { flex: 1 },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f0f0ff',
    marginBottom: 2,
  },
  commentBody: {
    fontSize: 13,
    color: 'rgba(240,240,255,0.75)',
    lineHeight: 18,
    marginBottom: 3,
  },
  commentTime: {
    fontSize: 10,
    color: 'rgba(240,240,255,0.3)',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(240,240,255,0.3)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    flex: 1,
    backgroundColor: '#0d0d14',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#f0f0ff',
    maxHeight: 100,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#a78bfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
})
