import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Modal, ActivityIndicator, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme'
import { getTimeAgo } from '../lib/matching'

const POST_TYPES = [
  { label: 'Confession', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { label: 'Shoutout', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  { label: 'Hot take', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  { label: 'Question', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
]

export default function ConfessionsScreen() {
  const theme = useTheme()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [body, setBody] = useState('')
  const [selectedType, setSelectedType] = useState(POST_TYPES[0])
  const [posting, setPosting] = useState(false)

  useEffect(() => { loadPosts() }, [])

  const loadPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('is_anonymous', true)
      .order('created_at', { ascending: false })
      .limit(20)

    setPosts(data ?? [])
    setLoading(false)
  }

  const submitPost = async () => {
    if (!body.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setPosting(true)

    const { error } = await supabase.from('posts').insert({
      author_id: user.id,
      body: body.trim(),
      tags: [selectedType.label],
      is_anonymous: true,
    })

    setPosting(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setBody('')
      setShowModal(false)
      loadPosts()
    }
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Confession board</Text>
          <Text style={s.subtitle}>Anonymous · moderated · campus only</Text>
        </View>
        <TouchableOpacity
          style={s.postBtn}
          onPress={() => setShowModal(true)}>
          <Text style={s.postBtnText}>+ Post</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#a78bfa" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {posts.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🎭</Text>
              <Text style={s.emptyTitle}>No confessions yet</Text>
              <Text style={s.emptyText}>Be the first to post anonymously!</Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => setShowModal(true)}>
                <Text style={s.emptyBtnText}>Make a confession</Text>
              </TouchableOpacity>
            </View>
          )}
          {posts.map((post: any, i: number) => {
            const type = POST_TYPES.find(t =>
              post.tags?.includes(t.label)
            ) ?? POST_TYPES[0]
            return (
              <View key={post.id ?? i} style={s.card}>
                <View style={s.cardHeader}>
                  <View style={[s.anonAvatar, { backgroundColor: type.bg }]}>
                    <Text style={s.anonIcon}>🎭</Text>
                  </View>
                  <Text style={s.anonLabel}>
                    Anonymous · {getTimeAgo(post.created_at)}
                  </Text>
                  <View style={[s.typeBadge, { backgroundColor: type.bg }]}>
                    <Text style={[s.typeText, { color: type.color }]}>
                      {type.label}
                    </Text>
                  </View>
                </View>
                <Text style={s.cardBody}>{post.body}</Text>
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.action}>
                    <Text style={s.actionText}>❤️ {post.likes_count ?? 0}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.action}>
                    <Text style={s.actionText}>
                      💬 {post.comments_count ?? 0}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.action}>
                    <Text style={s.actionText}>🔗 Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Post anonymously</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.modalLabel}>Type</Text>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
              {POST_TYPES.map((type, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.typeChip,
                    { borderColor: type.color + '40' },
                    selectedType.label === type.label && {
                      backgroundColor: type.bg,
                      borderColor: type.color,
                    },
                  ]}
                  onPress={() => setSelectedType(type)}>
                  <Text style={[
                    s.typeChipText,
                    { color: selectedType.label === type.label ? type.color : 'rgba(240,240,255,0.4)' },
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={s.bodyInput}
              placeholder="What's on your mind? No one will know it's you..."
              placeholderTextColor="rgba(240,240,255,0.25)"
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={300}
              autoFocus
            />
            <Text style={s.charCount}>{body.length}/300</Text>

            <View style={s.anonNote}>
              <Text style={s.anonNoteText}>
                🔒 Your identity is completely hidden from other students
              </Text>
            </View>

            <TouchableOpacity
              style={[s.submitBtn, posting && { opacity: 0.6 }]}
              onPress={submitPost}
              disabled={posting}>
              {posting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>Post anonymously</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 12,
  },
  back: { fontSize: 14, color: '#a78bfa' },
  title: { fontSize: 16, fontWeight: '700', color: '#f0f0ff', textAlign: 'center' },
  subtitle: { fontSize: 10, color: 'rgba(240,240,255,0.3)', textAlign: 'center' },
  postBtn: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  postBtnText: { fontSize: 12, color: '#a78bfa', fontWeight: '500' },
  empty: {
    margin: 24, alignItems: 'center', gap: 10,
    backgroundColor: '#1c1c2e', borderRadius: 20, padding: 32,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.4)', textAlign: 'center' },
  emptyBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 4,
  },
  emptyBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  card: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#1c1c2e', borderRadius: 16, padding: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 10,
  },
  anonAvatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  anonIcon: { fontSize: 14 },
  anonLabel: { flex: 1, fontSize: 11, color: 'rgba(240,240,255,0.35)' },
  typeBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { fontSize: 10, fontWeight: '500' },
  cardBody: {
    fontSize: 14, color: 'rgba(240,240,255,0.85)',
    lineHeight: 22, marginBottom: 12,
  },
  cardActions: { flexDirection: 'row', gap: 16 },
  action: { flexDirection: 'row', alignItems: 'center' },
  actionText: { fontSize: 12, color: 'rgba(240,240,255,0.35)' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1c1c2e', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  modalClose: { fontSize: 18, color: 'rgba(240,240,255,0.4)' },
  modalLabel: {
    fontSize: 11, color: 'rgba(240,240,255,0.4)',
    marginBottom: 8, fontWeight: '500',
  },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 0.5, backgroundColor: 'transparent',
  },
  typeChipText: { fontSize: 12, fontWeight: '500' },
  bodyInput: {
    backgroundColor: '#0d0d14', borderRadius: 12,
    padding: 14, fontSize: 14, color: '#f0f0ff',
    minHeight: 120, textAlignVertical: 'top',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  charCount: {
    fontSize: 11, color: 'rgba(240,240,255,0.25)',
    textAlign: 'right', marginTop: 4, marginBottom: 10,
  },
  anonNote: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderRadius: 10, padding: 10, marginBottom: 14,
    borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.2)',
  },
  anonNoteText: { fontSize: 12, color: '#34d399' },
  submitBtn: {
    backgroundColor: '#a78bfa', borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
  },
  submitText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})