import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
  Image, FlatList,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import React, { useState, useEffect, useCallback, useRef } from 'react'
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
import { useBadgesStore } from '../../store/badgesStore'

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
    if (obj._type === 'image') return `${prefix}📷 Photo`
    if (obj._type === 'video') return `${prefix}🎥 Video`
  } catch {
    // Not JSON
  }
  return `${prefix}${body}`
}

// ─── Recent friend bubble (Snapchat top row) ─────────────────────────────────
function FriendBubble({ conv, myId, isOnline, onPress, streak }: {
  conv: any; myId: string; isOnline: (id: string) => boolean; onPress: () => void
  streak?: { streak_count: number; at_risk: boolean }
}) {
  const theme = useTheme()
  const scale = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const participants = conv.conversations?.conversation_participants ?? []
  const other = participants.find((p: any) => p.user_id !== myId)
  const online = other?.user_id ? isOnline(other.user_id) : false
  const displayName = (other?.profiles?.full_name ?? conv.conversations?.name ?? 'Chat').split(' ')[0]
  const otherAvatar = other?.profiles?.avatar_url
  const hasUnread = conv.unreadCount > 0

  return (
    <Animated.View style={[animStyle, { alignItems: 'center', marginHorizontal: 8 }]}>
      <TouchableOpacity
        style={{ alignItems: 'center' }}
        onPressIn={() => { scale.value = withSpring(0.92, { damping: 14 }) }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14 }) }}
        onPress={onPress}
        activeOpacity={1}>
        <View style={fb.avatarWrap}>
          {/* Gradient ring for unread */}
          {hasUnread && <View style={[fb.unreadRing, { borderColor: theme.accent }]} />}
          {otherAvatar ? (
            <Image
              source={{ uri: otherAvatar }}
              style={[fb.avatar, online && { borderColor: '#34d399', borderWidth: 2.5 }]}
            />
          ) : (
            <View style={[fb.avatarFallback, { backgroundColor: theme.card2 },
              online && { borderColor: '#34d399', borderWidth: 2.5 }]}>
              <Text style={fb.avatarText}>{getInitials(displayName)}</Text>
            </View>
          )}
          {online && (
            <View style={[fb.onlineDot, { borderColor: theme.bg }]}>
              <PulseOnlineDot />
            </View>
          )}
          {hasUnread && (
            <View style={fb.unreadBadge}>
              <Text style={fb.unreadBadgeText}>{conv.unreadCount > 9 ? '9+' : conv.unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={[fb.name, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
        {streak && streak.streak_count > 0 && (
          <Text style={[fb.streakLabel, streak.at_risk ? { color: '#fbbf24' } : { color: '#f97316' }]}>
            {streak.at_risk ? '⌛' : '🔥'} {streak.streak_count}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}
const fb = StyleSheet.create({
  avatarWrap: { position: 'relative', marginBottom: 6 },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarFallback: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontFamily: typography.fontSemiBold, color: '#c4b5fd' },
  unreadRing: {
    position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
    borderRadius: 34, borderWidth: 2.5,
  },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'transparent', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute', top: -2, right: -4,
    backgroundColor: '#ef4444', borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadBadgeText: { color: '#fff', fontSize: 9, fontFamily: typography.fontBold },
  name: { fontSize: 11, fontFamily: typography.fontMedium, maxWidth: 64, textAlign: 'center' },
  streakLabel: { fontSize: 10, fontFamily: typography.fontBold, textAlign: 'center' },
})

// ─── DM row (below the friends row) ──────────────────────────────────────────
function DmRow({ conv, myId, isOnline, onPress, streak }: {
  conv: any; myId: string; isOnline: (id: string) => boolean; onPress: () => void
  streak?: { streak_count: number; at_risk: boolean }
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
  const isMe = lastMsg?.sender_id === myId
  const hasUnread = conv.unreadCount > 0

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={[dmr.row]}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 14 }) }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14 }) }}
        onPress={onPress}
        activeOpacity={1}>
        {/* Avatar */}
        <View style={dmr.avatarWrap}>
          {otherAvatar ? (
            <Image
              source={{ uri: otherAvatar }}
              style={[dmr.avatar, online && { borderWidth: 2, borderColor: '#34d399' }]}
            />
          ) : (
            <View style={[dmr.avatarFallback, { backgroundColor: theme.card2 },
              online && { borderWidth: 2, borderColor: '#34d399' }]}>
              <Text style={dmr.avatarText}>{getInitials(displayName)}</Text>
            </View>
          )}
          {online && (
            <View style={[dmr.onlineDot, { borderColor: theme.bg }]}>
              <PulseOnlineDot />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={dmr.info}>
          <View style={dmr.nameRow}>
            <Text style={[dmr.name, { color: theme.text }, hasUnread && { fontFamily: typography.fontBold }]}
              numberOfLines={1}>{displayName}</Text>
            <Text style={[dmr.time, { color: hasUnread ? theme.accent : theme.textFaint },
              hasUnread && { fontFamily: typography.fontSemiBold }]}>
              {lastMsg ? getTimeAgo(lastMsg.created_at) : ''}
            </Text>
          </View>
          <Text style={[dmr.preview,
            { color: hasUnread ? theme.text : theme.textMuted },
            hasUnread && { fontFamily: typography.fontMedium }]}
            numberOfLines={1}>
            {lastMsg ? formatMessagePreview(lastMsg.body, isMe) : 'Start a conversation'}
          </Text>
        </View>

        {/* Unread indicator / streak */}
        {hasUnread ? (
          <View style={[dmr.unreadDot, { backgroundColor: theme.accent }]} />
        ) : streak && streak.streak_count > 0 ? (
          <View style={[dmr.streakBadge,
            streak.at_risk
              ? { backgroundColor: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.3)' }
              : { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.3)' }
          ]}>
            <Text style={dmr.streakText}>{streak.at_risk ? '⌛' : '🔥'} {streak.streak_count}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={14} color={theme.textFaint} />
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}
const dmr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 26,
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
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  name: { fontSize: 15, fontFamily: typography.fontSemiBold, flex: 1 },
  time: { fontSize: 11, fontFamily: typography.fontRegular, marginLeft: 8 },
  preview: { fontSize: 13, fontFamily: typography.fontRegular },
  unreadDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 10, borderWidth: 0.5,
  },
  streakText: { fontSize: 11, fontFamily: typography.fontBold, color: '#f97316' },
})

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const isOnline = usePresenceStore(s => s.isOnline)
  const [myId, setMyId] = useState('')
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewChat, setShowNewChat] = useState(false)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [convSearch, setConvSearch] = useState('')
  const [streakMap, setStreakMap] = useState<Record<string, { streak_count: number; at_risk: boolean }>>({})
  const theme = useTheme()
  const { onScroll, scrollEventThrottle } = useTabBarScroll()
  const markSeen = useBadgesStore(s => s.markSeen)

  useFocusEffect(
    useCallback(() => {
      markSeen('chat')
    }, [markSeen])
  )

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
        .select('conversation_id, body, created_at, sender_id, is_read')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })

      const lastMsgMap: Record<string, any> = {}
      const unreadMap: Record<string, number> = {}
      msgs?.forEach((m: any) => {
        if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m
        if (!m.is_read && m.sender_id !== authUser.id) {
          unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] ?? 0) + 1
        }
      })

      const enriched = data
        .map((d: any) => ({
          ...d,
          lastMessage: lastMsgMap[d.conversation_id] ?? null,
          unreadCount: unreadMap[d.conversation_id] ?? 0,
        }))
        .sort((a: any, b: any) => {
          const aTime = a.lastMessage?.created_at ?? a.conversations?.created_at ?? ''
          const bTime = b.lastMessage?.created_at ?? b.conversations?.created_at ?? ''
          return bTime.localeCompare(aTime)
        })

      setConversations(enriched)

      // Load chat streaks for all conversations in one query
      const { data: streaks } = await supabase
        .from('chat_streaks')
        .select('user1_id, user2_id, streak_count, user1_sent_date, user2_sent_date, last_streak_date')
        .or(`user1_id.eq.${authUser.id},user2_id.eq.${authUser.id}`)

      if (streaks?.length) {
        const today = new Date()
        const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
          .toISOString().split('T')[0]
        const map: Record<string, { streak_count: number; at_risk: boolean }> = {}
        streaks.forEach((sr: any) => {
          const otherId = sr.user1_id === authUser.id ? sr.user2_id : sr.user1_id
          const mySentDate = sr.user1_id === authUser.id ? sr.user1_sent_date : sr.user2_sent_date
          const theirSentDate = sr.user1_id === authUser.id ? sr.user2_sent_date : sr.user1_sent_date
          const atRisk = (mySentDate === localDate || theirSentDate === localDate) &&
            !(mySentDate === localDate && theirSentDate === localDate)
          // Reset if broken
          const broken = sr.last_streak_date && sr.last_streak_date < localDate &&
            mySentDate !== localDate && theirSentDate !== localDate
          map[otherId] = { streak_count: broken ? 0 : (sr.streak_count ?? 0), at_risk: atRisk }
        })
        setStreakMap(map)
      }
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

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !isMounted) return

      listChannel = supabase
        .channel(`chat-list-updates-${Date.now()}-${Math.random()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload: any) => {
            setConversations(prev => {
              const myConvIds = new Set(prev.map((c: any) => c.conversation_id))
              if (myConvIds.size === 0 || myConvIds.has(payload.new?.conversation_id)) {
                loadConversations()
              }
              return prev
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

  // Separate "recent" (top 8) from the full list for the bubble row
  const recentConvs = conversations.slice(0, 8)

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={[s.title, { color: theme.text }]}>Chats</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => { setLoading(true); loadConversations() }}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Ionicons name="refresh" size={20} color={theme.textMuted} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}
            onPress={openNewChat}>
            <Ionicons name="create-outline" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── New chat picker ── */}
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
          <ScrollView showsVerticalScrollIndicator={false}>
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
          {/* ── Search bar ── */}
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
            /* Skeleton */
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Skeleton bubbles */}
              <View style={s.bubblesRow}>
                {[1, 2, 3, 4].map(i => (
                  <View key={i} style={{ alignItems: 'center', marginHorizontal: 8 }}>
                    <Skeleton width={60} height={60} borderRadius={30} />
                    <View style={{ marginTop: 6 }}>
                      <Skeleton width={48} height={10} />
                    </View>
                  </View>
                ))}
              </View>
              {/* Skeleton rows */}
              <View style={{ marginTop: 8 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <View key={i} style={[s.skeletonRow]}>
                    <Skeleton width={52} height={52} borderRadius={26} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <Skeleton width="45%" height={13} />
                      <Skeleton width="72%" height={11} />
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
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
            <FlatList
              data={filteredConversations}
              keyExtractor={(item, i) => item.conversation_id ?? String(i)}
              showsVerticalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={scrollEventThrottle}
              contentContainerStyle={{ paddingBottom: 32 }}
              ListHeaderComponent={
                /* ── Friend bubble row ── */
                recentConvs.length > 0 && !convSearch.trim() ? (
                  <View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={s.bubblesRow}
                      style={[s.bubblesScroll, { borderBottomColor: theme.border }]}>
                      {recentConvs.map((c, i) => {
                        const other = (c.conversations?.conversation_participants ?? []).find((p: any) => p.user_id !== myId)
                        return (
                          <FriendBubble
                            key={c.conversation_id ?? i}
                            conv={c}
                            myId={myId}
                            isOnline={isOnline}
                            onPress={() => openConversation(c)}
                            streak={other?.user_id ? streakMap[other.user_id] : undefined}
                          />
                        )
                      })}
                    </ScrollView>
                    {/* Section label */}
                    <Text style={[s.sectionLabel, { color: theme.textMuted }]}>All messages</Text>
                  </View>
                ) : null
              }
              renderItem={({ item: c }) => {
                const other = (c.conversations?.conversation_participants ?? []).find((p: any) => p.user_id !== myId)
                return (
                  <DmRow
                    conv={c}
                    myId={myId}
                    isOnline={isOnline}
                    onPress={() => openConversation(c)}
                    streak={other?.user_id ? streakMap[other.user_id] : undefined}
                  />
                )
              }}
              ItemSeparatorComponent={() => (
                <View style={[s.separator, { backgroundColor: theme.border, marginLeft: 80 }]} />
              )}
              ListEmptyComponent={
                convSearch.trim() ? (
                  <Text style={[s.noResults, { color: theme.textMuted }]}>No conversations found</Text>
                ) : null
              }
            />
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
  title: { fontSize: 24, fontFamily: typography.fontBold },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 0.5, alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 4,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    gap: 8, borderWidth: 0.5,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: typography.fontRegular },

  /* Bubble row */
  bubblesScroll: {
    borderBottomWidth: 0.5, paddingBottom: 12,
  },
  bubblesRow: {
    paddingHorizontal: 12, paddingVertical: 14, gap: 4,
    flexDirection: 'row',
  },

  /* Section label */
  sectionLabel: {
    fontSize: 12, fontFamily: typography.fontSemiBold,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  separator: { height: 0.5 },

  skeletonRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },

  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 10, marginTop: 100,
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
