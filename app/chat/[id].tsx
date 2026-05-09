import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '../../lib/supabase'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { useTheme } from '../../lib/theme'

export default function DirectMessageScreen() {
  const { id: otherUserId } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [myId, setMyId] = useState('')
  const [convId, setConvId] = useState<string | null>(null)
  const [otherProfile, setOtherProfile] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const theme = useTheme()

  const initConversation = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !otherUserId) { setLoading(false); return }
    setMyId(user.id)

    // Load other user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, is_online')
      .eq('id', otherUserId)
      .single()
    setOtherProfile(profile)

    // Find existing 1:1 conversation
    const [{ data: myConvs }, { data: theirConvs }] = await Promise.all([
      supabase.from('conversation_participants').select('conversation_id').eq('user_id', user.id),
      supabase.from('conversation_participants').select('conversation_id').eq('user_id', otherUserId),
    ])
    const myIds = new Set(myConvs?.map((c: any) => c.conversation_id) ?? [])
    const existing = theirConvs?.find((c: any) => myIds.has(c.conversation_id))

    let cid: string
    if (existing) {
      cid = existing.conversation_id
    } else {
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({ name: profile?.full_name ?? 'Chat', is_group: false })
        .select().single()
      if (convError || !conv) {
        setLoading(false)
        Alert.alert('Could not start chat', convError?.message ?? 'Please try again.')
        return
      }
      const { error: partError } = await supabase.from('conversation_participants').insert([
        { conversation_id: conv.id, user_id: user.id },
        { conversation_id: conv.id, user_id: otherUserId },
      ])
      if (partError) {
        setLoading(false)
        Alert.alert('Could not start chat', partError.message)
        return
      }
      cid = conv.id
    }

    setConvId(cid)

    // Load messages
    const { data: msgs } = await supabase
      .from('messages')
      .select('*, profiles(id, full_name, avatar_url)')
      .eq('conversation_id', cid)
      .order('created_at', { ascending: true })
    setMessages(msgs ?? [])
    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100)
  }, [otherUserId])

  useEffect(() => {
    initConversation()
  }, [initConversation])

  // Realtime subscription
  useEffect(() => {
    if (!convId) return
    const channel = supabase
      .channel('dm:' + convId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + convId,
      }, async (payload: any) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', payload.new.sender_id)
          .single()
        setMessages(prev => {
          const optimisticIdx = prev.findIndex(m => m._optimistic && m.body === payload.new.body)
          if (optimisticIdx >= 0) {
            const updated = [...prev]
            updated[optimisticIdx] = { ...payload.new, profiles: profile }
            return updated
          }
          return [...prev, { ...payload.new, profiles: profile }]
        })
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [convId])

  const sendMessage = async () => {
    if (!input.trim() || !convId || sending) return
    const text = input.trim()
    setInput('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const optimistic = {
      id: `opt_${Date.now()}`,
      _optimistic: true,
      conversation_id: convId,
      sender_id: myId,
      body: text,
      created_at: new Date().toISOString(),
      profiles: null,
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)

    setSending(true)
    const { error: sendError } = await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: myId,
      body: text,
    })
    setSending(false)

    if (sendError) {
      setMessages(prev => prev.filter(m => !(m._optimistic && m.body === text)))
      Alert.alert('Failed to send', 'Your message could not be sent. Please try again.')
    }
  }

  const otherName = otherProfile?.full_name ?? 'Chat'
  const isOnline = otherProfile?.is_online ?? false

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <View style={s.avatarWrap}>
            {otherProfile?.avatar_url ? (
              <Image source={{ uri: otherProfile.avatar_url }} style={s.avatar} />
            ) : (
              <View style={[s.avatarFallback, { backgroundColor: theme.card2 }]}>
                <Text style={s.avatarText}>{getInitials(otherName)}</Text>
              </View>
            )}
            <View style={[s.onlineDot, { backgroundColor: isOnline ? '#34d399' : 'transparent' }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerName, { color: theme.text }]}>{otherName}</Text>
            <Text style={[s.headerStatus, { color: isOnline ? '#34d399' : theme.textFaint }]}>
              {isOnline ? 'Active now' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Messages */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={s.messages}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}>
            {messages.length === 0 && (
              <View style={s.emptyWrap}>
                <Text style={s.emptyEmoji}>👋</Text>
                <Text style={[s.emptyText, { color: theme.textMuted }]}>Say hello to {otherName}!</Text>
              </View>
            )}
            {messages.map((m, i) => {
              const mine = m.sender_id === myId
              const showAvatar = !mine && (i === 0 || messages[i - 1]?.sender_id !== m.sender_id)
              return (
                <View key={m.id ?? i} style={[s.msgRow, mine && s.msgRowMine]}>
                  {!mine && (
                    <View style={s.msgAvatarCol}>
                      {showAvatar ? (
                        m.profiles?.avatar_url ? (
                          <Image source={{ uri: m.profiles.avatar_url }} style={s.msgAvatar} />
                        ) : (
                          <View style={[s.msgAvatarFallback, { backgroundColor: theme.card2 }]}>
                            <Text style={s.msgAvatarText}>{getInitials(m.profiles?.full_name ?? 'U')}</Text>
                          </View>
                        )
                      ) : (
                        <View style={{ width: 28 }} />
                      )}
                    </View>
                  )}
                  <View style={[
                    s.bubble,
                    mine
                      ? { backgroundColor: theme.accent, borderBottomRightRadius: 4 }
                      : { backgroundColor: theme.card, borderBottomLeftRadius: 4 },
                    m._optimistic && { opacity: 0.65 },
                  ]}>
                    <Text style={[s.bubbleText, { color: mine ? '#fff' : theme.text }]}>{m.body}</Text>
                    <Text style={[s.bubbleTime, { color: mine ? 'rgba(255,255,255,0.6)' : theme.textFaint }]}>
                      {getTimeAgo(m.created_at)}
                    </Text>
                  </View>
                </View>
              )
            })}
          </ScrollView>
        )}

        {/* Input */}
        <View style={[s.inputRow, { borderTopColor: theme.border, backgroundColor: theme.bg, paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="Message..."
            placeholderTextColor={theme.textFaint}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: input.trim() ? theme.accent : theme.card }, (!input.trim() || sending || !convId) && { opacity: 0.5 }]}
            onPress={sendMessage}
            disabled={!input.trim() || sending || !convId}>
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={16} color={input.trim() ? '#fff' : theme.textMuted} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    gap: 12, borderBottomWidth: 0.5,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '600', color: '#c4b5fd' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  headerName: { fontSize: 15, fontWeight: '600' },
  headerStatus: { fontSize: 11, marginTop: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messages: { flex: 1 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 14 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6, gap: 6 },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgAvatarCol: { width: 28 },
  msgAvatar: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarFallback: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  msgAvatarText: { fontSize: 10, fontWeight: '600', color: '#c4b5fd' },
  bubble: { maxWidth: '72%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 9, marginTop: 3, textAlign: 'right' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    gap: 10, borderTopWidth: 0.5,
  },
  input: {
    flex: 1, borderRadius: 22, paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 10,
    fontSize: 14, borderWidth: 0.5, maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
})
