import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'

const conversations = [
  {
    id: 1, initials: 'AO', name: 'Aisha Okafor', bg: '#2a1e40',
    preview: 'Are you going to the spoken word night?',
    time: '9:38am', unread: 2, online: true,
  },
  {
    id: 2, initials: 'HS', name: 'Hackathon Squad 🛠', bg: '#1e2a20',
    preview: 'Chidi: I will handle the backend, you guys...',
    time: '9:15am', unread: 5, online: false,
  },
  {
    id: 3, initials: 'FN', name: 'Fatima Nwosu', bg: '#1e2030',
    preview: 'Thanks for the study notes!',
    time: 'Yesterday', unread: 0, online: true,
  },
  {
    id: 4, initials: 'TI', name: 'Tobi Ibeh', bg: '#2a2010',
    preview: 'Are you joining the photography club?',
    time: 'Yesterday', unread: 0, online: false,
  },
  {
    id: 5, initials: 'CB', name: 'Chidi Bello', bg: '#1e2a20',
    preview: 'The hackathon is going to be insane!',
    time: 'Mon', unread: 0, online: true,
  },
]

const messages = [
  { id: 1, text: 'Are you going to the spoken word night? 🎤', mine: false },
  { id: 2, text: 'Yes! Just RSVP\'d on FAF. See you there?', mine: true },
  { id: 3, text: 'Definitely! Link at 5:30 before it starts', mine: false },
  { id: 4, text: 'Perfect, see you then 🙌', mine: true },
]

export default function ChatScreen() {
  const [activeChat, setActiveChat] = useState<number | null>(null)
  const [input, setInput] = useState('')

  const active = conversations.find(c => c.id === activeChat)

  if (activeChat && active) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.chatHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => setActiveChat(null)}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <View style={[s.chatAvatar, { backgroundColor: active.bg }]}>
            <Text style={s.chatAvatarText}>{active.initials}</Text>
          </View>
          <View style={s.chatHeaderInfo}>
            <Text style={s.chatHeaderName}>{active.name}</Text>
            {active.online && (
              <Text style={s.chatOnline}>Online now</Text>
            )}
          </View>
        </View>

        <ScrollView
          style={s.messagesArea}
          contentContainerStyle={{ padding: 16, gap: 10 }}>
          {messages.map((m) => (
            <View
              key={m.id}
              style={[s.bubbleWrap, m.mine && s.bubbleWrapMine]}>
              <View style={[s.bubble, m.mine ? s.bubbleMine : s.bubbleThem]}>
                <Text style={[s.bubbleText, m.mine && s.bubbleTextMine]}>
                  {m.text}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Type a message..."
            placeholderTextColor="rgba(240,240,255,0.3)"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity style={s.sendBtn}>
            <Text style={s.sendText}>➤</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
        <TouchableOpacity style={s.composeBtn}>
          <Text style={s.composeText}>✏</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          placeholder="Search messages..."
          placeholderTextColor="rgba(240,240,255,0.3)"
          style={s.searchInput}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {conversations.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={s.chatItem}
            onPress={() => setActiveChat(c.id)}>
            <View style={s.avatarWrap}>
              <View style={[s.avatar, { backgroundColor: c.bg }]}>
                <Text style={s.avatarText}>{c.initials}</Text>
              </View>
              {c.online && <View style={s.onlineDot} />}
            </View>
            <View style={s.chatInfo}>
              <Text style={s.chatName}>{c.name}</Text>
              <Text style={s.chatPreview} numberOfLines={1}>{c.preview}</Text>
            </View>
            <View style={s.chatMeta}>
              <Text style={s.chatTime}>{c.time}</Text>
              {c.unread > 0 && (
                <View style={s.unreadBadge}>
                  <Text style={s.unreadText}>{c.unread}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#f0f0ff' },
  composeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  composeText: { fontSize: 16, color: '#a78bfa' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1c1c2e',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 13, color: '#f0f0ff' },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  onlineDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#34d399',
    position: 'absolute', bottom: 0, right: 0,
    borderWidth: 2, borderColor: '#0d0d14',
  },
  chatInfo: { flex: 1, minWidth: 0 },
  chatName: { fontSize: 14, fontWeight: '500', color: '#f0f0ff', marginBottom: 3 },
  chatPreview: { fontSize: 12, color: 'rgba(240,240,255,0.35)' },
  chatMeta: { alignItems: 'flex-end', gap: 6 },
  chatTime: { fontSize: 11, color: 'rgba(240,240,255,0.25)' },
  unreadBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#a78bfa',
    alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1c1c2e',
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 18, color: '#f0f0ff' },
  chatAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { fontSize: 14, fontWeight: '600', color: '#f0f0ff' },
  chatOnline: { fontSize: 11, color: '#34d399' },
  messagesArea: { flex: 1 },
  bubbleWrap: { flexDirection: 'row' },
  bubbleWrapMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleThem: {
    backgroundColor: '#1c1c2e',
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    borderBottomRightRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  bubbleText: { fontSize: 13, color: 'rgba(240,240,255,0.7)', lineHeight: 20 },
  bubbleTextMine: { color: '#f0f0ff' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  input: {
    flex: 1,
    backgroundColor: '#1c1c2e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    color: '#f0f0ff',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(167,139,250,0.2)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  sendText: { fontSize: 16, color: '#a78bfa' },
})