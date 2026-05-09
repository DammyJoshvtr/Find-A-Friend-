import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState, useEffect, useRef, useCallback } from 'react'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '../../lib/supabase'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { getAllProfiles } from '../../lib/profiles'
import { Skeleton } from '../../components/ui/Skeleton'
import { useTheme } from '../../lib/theme'

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConv, setActiveConv] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [myId, setMyId] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [convSearch, setConvSearch] = useState('')
  const scrollRef = useRef<ScrollView>(null)
  const theme = useTheme()

  // Stable reference so it can be safely listed in useEffect deps
  const loadConversations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Set myId here — avoids a second duplicate getUser() call
      setMyId(user.id)

      const { data } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations(
            id, name, is_group, created_at,
            conversation_participants(user_id, profiles(id, full_name, avatar_url, is_online))
          )
        `)
        .eq('user_id', user.id)

      if (!data?.length) { setConversations([]); setLoading(false); return }

      const convIds = data.map((d: any) => d.conversation_id)
      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, body, created_at, sender_id')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })

      const lastMsgMap: Record<string, any> = {}
      msgs?.forEach((m: any) => { if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m })

      const enriched = data
        .map((d: any) => ({ ...d, lastMessage: lastMsgMap[d.conversation_id] ?? null }))
        .sort((a: any, b: any) => {
          const aTime = a.lastMessage?.created_at ?? a.conversations?.created_at ?? ''
          const bTime = b.lastMessage?.created_at ?? b.conversations?.created_at ?? ''
          return bTime.localeCompare(aTime)
        })

      setConversations(enriched)
    } catch (error) {
      console.log('Chat error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + realtime channel to keep conversation-list previews up-to-date
  useEffect(() => {
    loadConversations()

    const listChannel = supabase
      .channel('chat-list-updates')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, () => {
        // Refresh the list so the last-message preview stays current
        loadConversations()
      })
      .subscribe()

    return () => { supabase.removeChannel(listChannel) }
  }, [loadConversations])

  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(id, full_name, avatar_url)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100)
  }, [])

  useEffect(() => {
    if (!activeConv || !activeConv.conversations?.id) return
    loadMessages(activeConv.conversations.id)
    const channel = supabase
      .channel('chat:' + activeConv.conversations.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + activeConv.conversations.id,
      }, async (payload: any) => {
        // Fetch sender profile for incoming messages
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', payload.new.sender_id)
          .single()
        setMessages(prev => {
          // Replace optimistic message if it exists, otherwise append
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
  }, [activeConv, loadMessages])

  const sendMessage = async () => {
    if (!input.trim() || !activeConv || !activeConv.conversations?.id || sending) return
    const text = input.trim()
    setInput('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Optimistic update
    const optimistic = {
      id: `opt_${Date.now()}`,
      _optimistic: true,
      conversation_id: activeConv.conversations.id,
      sender_id: myId,
      body: text,
      created_at: new Date().toISOString(),
      profiles: null,
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)

    setSending(true)
    const { error: sendError } = await supabase.from('messages').insert({
      conversation_id: activeConv.conversations.id,
      sender_id: myId,
      body: text,
    })
    setSending(false)

    if (sendError) {
      // Roll back optimistic message
      setMessages(prev => prev.filter(m => !(m._optimistic && m.body === text)))
      Alert.alert('Failed to send', 'Your message could not be sent. Please try again.')
    }
  }

  const startNewChat = (otherUser: any) => {
    setShowNewChat(false)
    setUserSearch('')
    router.push(`/chat/${otherUser.id}` as any)
  }

  const openNewChat = async () => {
    const users = await getAllProfiles()
    setAllUsers(users)
    setShowNewChat(true)
  }

  // ─── Chat view ──────────────────────────────────────────────────────────────
  if (activeConv) {
    const participants = activeConv.conversations?.conversation_participants ?? []
    const other = participants.find((p: any) => p.user_id !== myId)
    const isOtherOnline = other?.profiles?.is_online ?? false
    const otherAvatar = other?.profiles?.avatar_url
    const otherName = activeConv.conversations?.name ?? 'Chat'

    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Header */}
          <View style={[s.chatHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => setActiveConv(null)}>
              <Ionicons name="arrow-back" size={20} color={theme.text} />
            </TouchableOpacity>
            <View style={s.chatAvatarWrap}>
              {otherAvatar ? (
                <Image source={{ uri: otherAvatar }} style={s.chatAvatarImg} />
              ) : (
                <View style={[s.chatAvatar, { backgroundColor: theme.card2 }]}>
                  <Text style={s.chatAvatarText}>{getInitials(otherName)}</Text>
                </View>
              )}
              <View style={[s.onlineDotHeader, { backgroundColor: isOtherOnline ? '#34d399' : 'transparent' }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.chatHeaderName, { color: theme.text }]}>{otherName}</Text>
              <Text style={[s.chatOnline, { color: isOtherOnline ? '#34d399' : theme.textFaint }]}>
                {isOtherOnline ? 'Active now' : 'Offline'}
              </Text>
            </View>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={s.messagesArea}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}>
            {messages.length === 0 && (
              <View style={s.emptyChat}>
                <Text style={s.emptyChatEmoji}>👋</Text>
                <Text style={[s.emptyChatText, { color: theme.textMuted }]}>Say hello to {otherName}!</Text>
              </View>
            )}
            {messages.map((m, i) => {
              const mine = m.sender_id === myId
              const showAvatar = !mine && (i === 0 || messages[i - 1]?.sender_id !== m.sender_id)
              return (
                <View key={m.id ?? i} style={[s.msgRow, mine && s.msgRowMine]}>
                  {/* Other person avatar */}
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
              style={[s.sendBtn, { backgroundColor: input.trim() ? theme.accent : theme.card }, (!input.trim() || sending) && { opacity: 0.5 }]}
              onPress={sendMessage}
              disabled={!input.trim() || sending}>
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={16} color={input.trim() ? '#fff' : theme.textMuted} />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // ─── Conversations list ──────────────────────────────────────────────────────
  const filteredUsers = allUsers.filter(u =>
    (u.full_name ?? u.email ?? '').toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={s.header}>
        <Text style={[s.title, { color: theme.text }]}>Messages</Text>
        <TouchableOpacity
          style={[s.composeBtn, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}
          onPress={openNewChat}>
          <Ionicons name="create-outline" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      {/* New chat picker */}
      {showNewChat ? (
        <View style={{ flex: 1 }}>
          <View style={[s.newChatHeader, { borderBottomColor: theme.border }]}>
            <Text style={[s.newChatTitle, { color: theme.text }]}>New message</Text>
            <TouchableOpacity onPress={() => { setShowNewChat(false); setUserSearch('') }}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={[s.searchBar, { backgroundColor: theme.card, borderColor: theme.border, margin: 12, marginBottom: 4 }]}>
            <Ionicons name="search-outline" size={15} color={theme.textFaint} />
            <TextInput
              style={[s.searchInput, { color: theme.text }]}
              placeholder="Search students..."
              placeholderTextColor={theme.textFaint}
              value={userSearch}
              onChangeText={setUserSearch}
              autoFocus
            />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {filteredUsers.map((user, i) => (
              <TouchableOpacity
                key={user.id || i}
                style={[s.chatItem, { borderBottomColor: theme.border }]}
                onPress={() => startNewChat(user)}>
                {user.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={s.avatar} />
                ) : (
                  <View style={[s.avatarFallback, { backgroundColor: theme.card2 }]}>
                    <Text style={s.avatarText}>{getInitials(user.full_name || user.email)}</Text>
                  </View>
                )}
                <View style={s.chatInfo}>
                  <Text style={[s.chatName, { color: theme.text }]}>{user.full_name || user.email?.split('@')[0]}</Text>
                  <Text style={[s.chatPreview, { color: theme.textMuted }]}>{user.department || 'Student'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
              </TouchableOpacity>
            ))}
            {filteredUsers.length === 0 && (
              <Text style={[s.noResults, { color: theme.textMuted }]}>No students found</Text>
            )}
          </ScrollView>
        </View>
      ) : (
        <>
          {/* Search bar */}
          <View style={[s.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={15} color={theme.textFaint} />
            <TextInput
              placeholder="Search conversations..."
              placeholderTextColor={theme.textFaint}
              style={[s.searchInput, { color: theme.text }]}
              value={convSearch}
              onChangeText={setConvSearch}
            />
          </View>

          {loading ? (
            <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={[s.skeletonItem, { borderBottomColor: theme.border }]}>
                  <Skeleton width={50} height={50} borderRadius={25} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton width="45%" height={14} />
                    <Skeleton width="75%" height={11} />
                  </View>
                </View>
              ))}
            </View>
          ) : conversations.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>💬</Text>
              <Text style={[s.emptyTitle, { color: theme.text }]}>No messages yet</Text>
              <Text style={[s.emptyText, { color: theme.textMuted }]}>Start a conversation with a fellow student</Text>
              <TouchableOpacity style={[s.startBtn, { backgroundColor: theme.accent }]} onPress={openNewChat}>
                <Text style={s.startBtnText}>Start a chat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {conversations.filter(c => {
                if (!convSearch.trim()) return true
                const name = c.conversations?.name ?? ''
                return name.toLowerCase().includes(convSearch.toLowerCase())
              }).map((c, i) => {
                const participants = c.conversations?.conversation_participants ?? []
                const other = participants.find((p: any) => p.user_id !== myId)
                const isOnline = other?.profiles?.is_online ?? false
                const otherAvatar = other?.profiles?.avatar_url
                const displayName = c.conversations?.name ?? 'Chat'
                const lastMsg = c.lastMessage
                return (
                  <TouchableOpacity
                    key={c.conversation_id ?? i}
                    style={[s.chatItem, { borderBottomColor: theme.border }]}
                    onPress={() => setActiveConv(c)}>
                    <View style={s.avatarWrap}>
                      {otherAvatar ? (
                        <Image source={{ uri: otherAvatar }} style={s.avatar} />
                      ) : (
                        <View style={[s.avatarFallback, { backgroundColor: theme.card2 }]}>
                          <Text style={s.avatarText}>{getInitials(displayName)}</Text>
                        </View>
                      )}
                      {isOnline && <View style={[s.onlineBadge, { borderColor: theme.bg }]} />}
                    </View>
                    <View style={s.chatInfo}>
                      <View style={s.chatNameRow}>
                        <Text style={[s.chatName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
                        <Text style={[s.chatTime, { color: theme.textFaint }]}>
                          {lastMsg ? getTimeAgo(lastMsg.created_at) : ''}
                        </Text>
                      </View>
                      <Text style={[s.chatPreview, { color: theme.textMuted }]} numberOfLines={1}>
                        {lastMsg
                          ? (lastMsg.sender_id === myId ? `You: ${lastMsg.body}` : lastMsg.body)
                          : 'No messages yet'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700' },
  composeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    gap: 8, borderWidth: 0.5,
  },
  searchInput: { flex: 1, fontSize: 13 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10, marginTop: 80 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyText: { fontSize: 13, textAlign: 'center' },
  startBtn: { borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  startBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  newChatHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5,
  },
  newChatTitle: { fontSize: 16, fontWeight: '600' },
  noResults: { textAlign: 'center', fontSize: 13, marginTop: 32 },
  chatItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12, borderBottomWidth: 0.5 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '600', color: '#c4b5fd' },
  onlineBadge: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#34d399', borderWidth: 2 },
  chatInfo: { flex: 1, minWidth: 0 },
  chatNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  chatName: { fontSize: 14, fontWeight: '600', flex: 1 },
  chatPreview: { fontSize: 12 },
  chatTime: { fontSize: 11, marginLeft: 8 },
  skeletonItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12, borderBottomWidth: 0.5 },

  // Chat view
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, gap: 12, borderBottomWidth: 0.5,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chatAvatarWrap: { position: 'relative' },
  chatAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  chatAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  chatAvatarText: { fontSize: 13, fontWeight: '600', color: '#c4b5fd' },
  onlineDotHeader: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  chatHeaderName: { fontSize: 15, fontWeight: '600' },
  chatOnline: { fontSize: 11, marginTop: 1 },
  messagesArea: { flex: 1 },
  emptyChat: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyChatEmoji: { fontSize: 48 },
  emptyChatText: { fontSize: 14 },
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
