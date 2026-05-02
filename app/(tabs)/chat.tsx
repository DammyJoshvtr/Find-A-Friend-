import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { getAllProfiles } from '../../lib/profiles'

export default function ChatScreen() {
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [myId, setMyId] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const scrollRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyId(user.id)
    })
    loadConversations()
    const timeout = setTimeout(() => setLoading(false), 5000)
    return () => clearTimeout(timeout)
  }, [])

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('conversation_participants')
        .select('conversation_id, conversations(id, name, is_group, created_at)')
        .eq('user_id', user.id)
      setConversations(data ?? [])
    } catch (error) {
      console.log('Chat error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = useCallback(async (convId) => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(id, full_name)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [])

  useEffect(() => {
    if (!activeConv) return
    loadMessages(activeConv.conversations.id)
    const channel = supabase
      .channel('chat:' + activeConv.conversations.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + activeConv.conversations.id,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeConv, loadMessages])

  const sendMessage = async () => {
    if (!input.trim() || !activeConv || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    await supabase.from('messages').insert({
      conversation_id: activeConv.conversations.id,
      sender_id: myId,
      body: text,
    })
    setSending(false)
  }

  const startNewChat = async (otherUser) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ name: otherUser.full_name || otherUser.email, is_group: false })
      .select().single()
    if (!conv) return
    await supabase.from('conversation_participants').insert([
      { conversation_id: conv.id, user_id: user.id },
      { conversation_id: conv.id, user_id: otherUser.id },
    ])
    setShowNewChat(false)
    await loadConversations()
  }

  const openNewChat = async () => {
    const users = await getAllProfiles()
    setAllUsers(users)
    setShowNewChat(true)
  }

  if (activeConv) {
    return (
      <SafeAreaView style={s.container}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.chatHeader}>
            <TouchableOpacity style={s.backBtn} onPress={() => setActiveConv(null)}>
              <Ionicons name="arrow-back" size={20} color="#f0f0ff" />
            </TouchableOpacity>
            <View style={[s.chatAvatar, { backgroundColor: '#2a1e40' }]}>
              <Text style={s.chatAvatarText}>{getInitials(activeConv.conversations.name ?? 'CH')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.chatHeaderName}>{activeConv.conversations.name ?? 'Chat'}</Text>
              <Text style={s.chatOnline}>Active now</Text>
            </View>
          </View>
          <ScrollView ref={scrollRef} style={s.messagesArea}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.length === 0 && (
              <View style={s.emptyChat}>
                <Text style={s.emptyChatText}>No messages yet. Say hello! 👋</Text>
              </View>
            )}
            {messages.map((m, i) => {
              const mine = m.sender_id === myId
              return (
                <View key={m.id ?? i} style={[s.bubbleWrap, mine && s.bubbleWrapMine]}>
                  {!mine && <Text style={s.senderName}>{m.profiles?.full_name ?? 'User'}</Text>}
                  <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleThem]}>
                    <Text style={[s.bubbleText, mine && s.bubbleTextMine]}>{m.body}</Text>
                    <Text style={s.bubbleTime}>{getTimeAgo(m.created_at)}</Text>
                  </View>
                </View>
              )
            })}
          </ScrollView>
          <View style={s.inputRow}>
            <TextInput style={s.input} placeholder="Type a message..."
              placeholderTextColor="rgba(240,240,255,0.3)"
              value={input} onChangeText={setInput} multiline maxLength={500} />
            <TouchableOpacity style={[s.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
              onPress={sendMessage} disabled={!input.trim() || sending}>
              {sending ? <ActivityIndicator size="small" color="#a78bfa" /> : <Ionicons name="send" size={18} color="#a78bfa" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
        <TouchableOpacity style={s.composeBtn} onPress={openNewChat}>
          <Ionicons name="create-outline" size={20} color="#a78bfa" />
        </TouchableOpacity>
      </View>

      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={16} color="rgba(240,240,255,0.3)" />
        <TextInput placeholder="Search messages..." placeholderTextColor="rgba(240,240,255,0.3)" style={s.searchInput} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}><ActivityIndicator color="#a78bfa" /></View>
      ) : showNewChat ? (
        <View style={{ flex: 1 }}>
          <View style={s.newChatHeader}>
            <Text style={s.newChatTitle}>Start a new chat</Text>
            <TouchableOpacity onPress={() => setShowNewChat(false)}>
              <Ionicons name="close" size={22} color="rgba(240,240,255,0.4)" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {allUsers.map((user, i) => (
              <TouchableOpacity key={user.id || i} style={s.chatItem} onPress={() => startNewChat(user)}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{getInitials(user.full_name || user.email)}</Text>
                </View>
                <View style={s.chatInfo}>
                  <Text style={s.chatName}>{user.full_name || user.email?.split('@')[0]}</Text>
                  <Text style={s.chatPreview}>{user.department || 'Student'}</Text>
                </View>
                <Ionicons name="chatbubble-outline" size={18} color="#a78bfa" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>💬</Text>
          <Text style={s.emptyTitle}>No messages yet</Text>
          <Text style={s.emptyText}>Start a conversation with a student!</Text>
          <TouchableOpacity style={s.startBtn} onPress={openNewChat}>
            <Text style={s.startBtnText}>Start a chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {conversations.map((c, i) => (
            <TouchableOpacity key={c.conversation_id ?? i} style={s.chatItem} onPress={() => setActiveConv(c)}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{getInitials(c.conversations?.name ?? 'CH')}</Text>
              </View>
              <View style={s.chatInfo}>
                <Text style={s.chatName}>{c.conversations?.name ?? 'Chat'}</Text>
                <Text style={s.chatPreview}>Tap to open conversation</Text>
              </View>
              <Text style={s.chatTime}>{getTimeAgo(c.conversations?.created_at)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#f0f0ff' },
  composeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)', alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#1c1c2e', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, fontSize: 13, color: '#f0f0ff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10, marginTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#f0f0ff' },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.4)', textAlign: 'center' },
  startBtn: { backgroundColor: '#a78bfa', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  startBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  newChatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  newChatTitle: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  chatItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2a1e40', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '600', color: '#c4b5fd' },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 14, fontWeight: '500', color: '#f0f0ff', marginBottom: 3 },
  chatPreview: { fontSize: 12, color: 'rgba(240,240,255,0.35)' },
  chatTime: { fontSize: 11, color: 'rgba(240,240,255,0.25)' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center' },
  chatAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chatAvatarText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  chatHeaderName: { fontSize: 14, fontWeight: '600', color: '#f0f0ff' },
  chatOnline: { fontSize: 11, color: '#34d399' },
  messagesArea: { flex: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyChatText: { fontSize: 14, color: 'rgba(240,240,255,0.3)', textAlign: 'center' },
  bubbleWrap: { flexDirection: 'column', marginBottom: 4 },
  bubbleWrapMine: { alignItems: 'flex-end' },
  senderName: { fontSize: 10, color: 'rgba(240,240,255,0.4)', marginBottom: 3, marginLeft: 4 },
  bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleThem: { backgroundColor: '#1c1c2e', borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: 'rgba(167,139,250,0.2)', borderBottomRightRadius: 4, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)' },
  bubbleText: { fontSize: 13, color: 'rgba(240,240,255,0.7)', lineHeight: 20 },
  bubbleTextMine: { color: '#f0f0ff' },
  bubbleTime: { fontSize: 9, color: 'rgba(240,240,255,0.3)', marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.07)' },
  input: { flex: 1, backgroundColor: '#1c1c2e', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, color: '#f0f0ff', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(167,139,250,0.2)', borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)', alignItems: 'center', justifyContent: 'center' },
})
