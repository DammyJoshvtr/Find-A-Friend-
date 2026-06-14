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
  Platform,
  Keyboard,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import Toast from 'react-native-toast-message'
import { getComments, commentOnPost } from '../../lib/feed'
import { useFeedStore } from '../../store/feedStore'
import { getInitials, getTimeAgo } from '../../lib/matching'
import type { PostComment } from '../../lib/feed'
import { supabase } from '../../lib/supabase'

interface CommentSheetProps {
  postId: string
  visible: boolean
  onClose: () => void
  isAnonymousPost?: boolean
}

export default function CommentSheet({ postId, visible, onClose, isAnonymousPost = false }: CommentSheetProps) {
  const [comments, setComments] = useState<PostComment[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [kbHeight, setKbHeight] = useState(0)
  const inputRef = useRef<TextInput>(null)
  const { incrementCommentCount } = useFeedStore()

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKbHeight(e.endCoordinates.height)
    )
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0)
    )
    return () => { show.remove(); hide.remove() }
  }, [])

  useEffect(() => {
    if (!visible || !postId) return

    loadComments()

    const channel = supabase
      .channel(`post-comments-sheet:${postId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'post_comments',
        filter: `post_id=eq.${postId}`,
      }, async (payload: any) => {
        let profile = null
        if (!payload.new.is_anonymous) {
          const { data: p } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', payload.new.author_id)
            .single()
          profile = p
        }

        const newComment: PostComment = {
          ...payload.new,
          author_id: payload.new.is_anonymous ? null : payload.new.author_id,
          profiles: profile,
        }

        setComments(prev => {
          if (prev.some(c => c.id === newComment.id)) return prev
          return [...prev, newComment]
        })
        incrementCommentCount(postId)
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'post_comments',
        filter: `post_id=eq.${postId}`,
      }, (payload: any) => {
        setComments(prev => prev.filter(c => c.id !== payload.old?.id))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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
    const { data, error } = await commentOnPost(postId, trimmed, isAnonymousPost)
    setSending(false)
    if (error) {
      Toast.show({ type: 'error', text1: 'Comment failed', text2: error.message ?? 'Please try again.' })
      return
    }
    if (data) {
      setComments(prev => [...prev, data])
      incrementCommentCount(postId)
      setText('')
    }
  }

  const handleReply = (item: PostComment) => {
    const authorName = item.is_anonymous ? 'Anonymous' : (item.profiles?.full_name ?? 'User')
    // We replace spaces in the name with underscores for a valid looking tag, or just leave it. 
    // Actually, simple @Name is fine since regex doesn't care for spaces, wait, the regex uses @[a-zA-Z0-9_]+
    // So we need to sanitize the name to only have valid characters.
    const cleanName = authorName.replace(/[^a-zA-Z0-9_]/g, '')
    const tag = `@${cleanName} `
    setText(prev => prev ? `${prev} ${tag}` : tag)
    inputRef.current?.focus()
  }

  const renderCommentBody = (text: string | null | undefined) => {
    const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}|\b[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|ng|io|co|me|info|biz|uk|ca|de|jp|fr|au|us|ru|ch|it|nl|se|no|es|mil)\b(?:\/[^\s]*)?|#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/gi
    const parts = (text || '').split(regex)
    return (
      <Text style={s.commentBody}>
        {parts.map((part, i) => {
          if (part.startsWith('#'))
            return <Text key={i} style={{ color: '#a78bfa' }} onPress={() => { onClose(); router.push(`/hashtag/${part.slice(1)}` as any) }}>{part}</Text>
          if (part.startsWith('@'))
            return <Text key={i} style={{ color: '#a78bfa' }}>{part}</Text>
          if (part.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/i)) {
            return (
              <Text
                key={i}
                style={{ color: '#a78bfa', textDecorationLine: 'underline' }}
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
                style={{ color: '#a78bfa', textDecorationLine: 'underline' }}
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.commentAuthor}>
            {item.is_anonymous ? 'Anonymous' : (item.profiles?.full_name ?? 'User')}
          </Text>
          <Text style={s.commentTime}>{getTimeAgo(item.created_at)}</Text>
        </View>
        {renderCommentBody(item.body)}
        <View style={{ flexDirection: 'row', marginTop: 2 }}>
          <TouchableOpacity onPress={() => handleReply(item)}>
            <Text style={{ fontSize: 11, color: '#a78bfa', fontWeight: '600' }}>Reply</Text>
          </TouchableOpacity>
        </View>
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
        <View style={[s.sheet, { paddingBottom: kbHeight }]}>
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
        </View>
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
