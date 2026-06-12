import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
  Image,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect, useCallback } from 'react'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { getAllProfiles } from '../../lib/profiles'
import { Skeleton } from '../../components/ui/Skeleton'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { usePresenceStore } from '../../store/presenceStore'
import { useTabBarScroll } from '../../lib/useTabBarScroll'
import Toast from 'react-native-toast-message'

// ─── Pulsing online dot ───────────────────────────────────────────────────────
function PulseOnlineDot({ style }: { style?: object }) {
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.5, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1, true
    )
  }, [])
  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 2 - scale.value,
  }))
  return (
    <View style={[pod.wrap, style]}>
      <Animated.View style={[pod.ring, ring]} />
      <View style={pod.dot} />
    </View>
  )
}
const pod = StyleSheet.create({
  wrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: 10, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(52,211,153,0.35)',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34d399' },
})

function formatMessagePreview(body: string, isMe: boolean): string {
  if (!body) return ''
  const prefix = isMe ? 'You: ' : ''
  try {
    const obj = JSON.parse(body)
    if (obj._type === 'story_reaction') return `${prefix}Reacted ${obj.emoji} to story`
    if (obj._type === 'story_comment') return `${prefix}Commented on story`
    if (obj._type === 'game_challenge') return `${prefix}Sent a game challenge 🎮`
    if (obj._type === 'challenge_accepted') return `${prefix}Accepted challenge ⚡`
    if (obj._type === 'sticker') return `${prefix}Sent a sticker`
  } catch {
    // Not JSON
  }
  return `${prefix}${body}`
}

// ─── Conversation card ────────────────────────────────────────────────────────
function ConvCard({ conv, myId, isOnline, onPress }: {
  conv: any; myId: string; isOnline: (id: string) => boolean; onPress: () => void
}) {
  const theme = useTheme()
  const scale = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const participants = conv.conversations?.conversation_participants ?? []
  const other = participants.find((p: any) => p.user_id !== myId)
  const online = other?.user_id ? isOnline(other.user_id) : false
  const displayName = other?.profiles?.full_name ?? conv.conversations?.name ?? 'Chat'
  const otherAvatar = other?.profiles?.avatar_url
  const lastMsg = conv.lastMessage

  return (
    <Animated.View style={[animStyle, { marginHorizontal: 16, marginVertical: 4 }]}>
      <TouchableOpacity
        style={[
          cvs.card,
          { backgroundColor: theme.card, borderColor: online ? `${theme.accent}55` : theme.border },
          online && { borderLeftColor: theme.accent, borderLeftWidth: 2 },
        ]}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 14 }) }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14 }) }}
        onPress={onPress}
        activeOpacity={1}>
        {/* Avatar */}
        <View style={cvs.avatarWrap}>
          {otherAvatar ? (
            <Image
              source={{ uri: otherAvatar }}
              style={[cvs.avatar, online && { borderWidth: 2, borderColor: '#34d399' }]}
            />
          ) : (
            <View style={[
              cvs.avatarFallback, { backgroundColor: theme.card2 },
              online && { borderWidth: 2, borderColor: '#34d399' },
            ]}>
              <Text style={cvs.avatarText}>{getInitials(displayName)}</Text>
            </View>
          )}
          {online && (
            <View style={[cvs.onlineDot, { borderColor: theme.card }]}>
              <PulseOnlineDot />
            </View>
          )}
        </View>
        {/* Info */}
        <View style={cvs.info}>
          <View style={cvs.nameRow}>
            <Text style={[cvs.name, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
            <Text style={[cvs.time, { color: theme.textFaint }]}>
              {lastMsg ? getTimeAgo(lastMsg.created_at) : ''}
            </Text>
          </View>
          <Text style={[cvs.preview, { color: theme.textMuted }]} numberOfLines={1}>
            {lastMsg
              ? formatMessagePreview(lastMsg.body, lastMsg.sender_id === myId)
              : 'Start a conversation'}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}
const cvs = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 12, gap: 12, borderWidth: 0.5,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontFamily: typography.fontSemiBold, color: '#c4b5fd' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'transparent', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 14, fontFamily: typography.fontSemiBold, flex: 1 },
  time: { fontSize: 11, fontFamily: typography.fontRegular, marginLeft: 8 },
  preview: { fontSize: 12, fontFamily: typography.fontRegular },
})

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const isOnline = usePresenceStore(s => s.isOnline)
  // myId is set from supabase.auth.getUser() inside loadConversations
  // so it is always the real current-user ID, never an empty string
  const [myId, setMyId] = useState('')
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewChat, setShowNewChat] = useState(false)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [convSearch, setConvSearch] = useState('')
  const theme = useTheme()
  const { onScroll, scrollEventThrottle } = useTabBarScroll()

  const loadConversations = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { setLoading(false); return }
      setMyId(authUser.id)

      const { data } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations(
            id, name, is_group, created_at,
            conversation_participants(user_id, profiles(id, full_name, avatar_url))
          )
        `)
        .eq('user_id', authUser.id)

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

  useEffect(() => {
    loadConversations()

    let listChannel: ReturnType<typeof supabase.channel> | null = null
    let isMounted = true

    // We only subscribe once we know the user's conversation IDs.
    // getUser() is cached by Supabase so this is cheap.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !isMounted) return

      // Unique channel name to prevent "cannot add postgres_changes after subscribe" error
      // due to React 18 strict mode / hot reloads not cleaning up async channels instantly.
      listChannel = supabase
        .channel(`chat-list-updates-${Date.now()}-${Math.random()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload: any) => {
            // Only refetch if this message belongs to one of the user's convs.
            setConversations(prev => {
              const myConvIds = new Set(prev.map((c: any) => c.conversation_id))
              if (myConvIds.size === 0 || myConvIds.has(payload.new?.conversation_id)) {
                // Trigger async reload outside of setState
                loadConversations()
              }
              return prev // state unchanged here; loadConversations will update it
            })
          }
        )
        .subscribe()
    })

    return () => {
      isMounted = false
      if (listChannel) supabase.removeChannel(listChannel)
    }
  }, [loadConversations])

  const openConversation = (conv: any) => {
    const participants = conv.conversations?.conversation_participants ?? []
    const other = participants.find((p: any) => p.user_id !== myId)
    if (!other?.user_id) {
      // Group chat or missing participant — navigate by conversation id when supported
      Toast.show({ type: 'info', text1: 'Group chats coming soon!', text2: 'Direct messages only for now.' })
      return
    }
    router.push(`/chat/${other.user_id}` as any)
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

  const filteredUsers = allUsers.filter(u =>
    (u.full_name ?? u.email ?? '').toLowerCase().includes(userSearch.toLowerCase())
  )

  const filteredConversations = conversations.filter(c => {
    if (!convSearch.trim()) return true
    const participants = c.conversations?.conversation_participants ?? []
    const other = participants.find((p: any) => p.user_id !== myId)
    const name = other?.profiles?.full_name ?? c.conversations?.name ?? ''
    return name.toLowerCase().includes(convSearch.toLowerCase())
  })

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={s.header}>
        <Text style={[s.title, { color: theme.text }]}>Messages</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[s.composeBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => {
              setLoading(true)
              loadConversations()
            }}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Ionicons name="refresh" size={20} color={theme.textMuted} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.composeBtn, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}
            onPress={openNewChat}>
            <Ionicons name="create-outline" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>
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
          <View style={[s.searchBar, { backgroundColor: theme.card, borderColor: theme.border, margin: 12, marginBottom: 8 }]}>
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
          <ScrollView showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={scrollEventThrottle}>
            {filteredUsers.map((u, i) => (
              <TouchableOpacity
                key={u.id || i}
                style={[s.pickerItem, { borderBottomColor: theme.border }]}
                onPress={() => startNewChat(u)}>
                {u.avatar_url ? (
                  <Image source={{ uri: u.avatar_url }} style={s.pickerAvatar} />
                ) : (
                  <View style={[s.pickerAvatarFallback, { backgroundColor: theme.card2 }]}>
                    <Text style={s.pickerAvatarText}>{getInitials(u.full_name || u.email)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[s.pickerName, { color: theme.text }]}>{u.full_name || u.email?.split('@')[0]}</Text>
                  <Text style={[s.pickerSub, { color: theme.textMuted }]}>{u.department || 'Student'}</Text>
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
            <View style={{ paddingHorizontal: 16, marginTop: 8, gap: 8 }}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={[s.skeletonCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
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
            <ScrollView
              showsVerticalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={scrollEventThrottle}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}>
              {filteredConversations.map((c, i) => (
                <ConvCard
                  key={c.conversation_id ?? i}
                  conv={c}
                  myId={myId}
                  isOnline={isOnline}
                  onPress={() => openConversation(c)}
                />
              ))}
              {filteredConversations.length === 0 && convSearch.trim() !== '' && (
                <Text style={[s.noResults, { color: theme.textMuted }]}>No conversations found</Text>
              )}
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
  title: { fontSize: 22, fontFamily: typography.fontBold },
  composeBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 0.5, alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    gap: 8, borderWidth: 0.5,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: typography.fontRegular },
  skeletonCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    padding: 12, gap: 12, borderWidth: 0.5,
  },
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 10, marginTop: 80,
  },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontFamily: typography.fontSemiBold },
  emptyText: { fontSize: 13, textAlign: 'center', fontFamily: typography.fontRegular },
  startBtn: { borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  startBtnText: { fontSize: 14, fontFamily: typography.fontSemiBold, color: '#fff' },
  newChatHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5,
  },
  newChatTitle: { fontSize: 16, fontFamily: typography.fontSemiBold },
  noResults: { textAlign: 'center', fontSize: 13, marginTop: 32, fontFamily: typography.fontRegular },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    gap: 12, borderBottomWidth: 0.5,
  },
  pickerAvatar: { width: 44, height: 44, borderRadius: 22 },
  pickerAvatarFallback: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pickerAvatarText: { fontSize: 14, fontFamily: typography.fontSemiBold, color: '#c4b5fd' },
  pickerName: { fontSize: 14, fontFamily: typography.fontSemiBold, marginBottom: 2 },
  pickerSub: { fontSize: 12, fontFamily: typography.fontRegular },
})
