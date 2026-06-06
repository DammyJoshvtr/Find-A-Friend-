/**
 * app/club-room/[id].tsx
 * Real-time group chat for a club. Uses the club_messages table.
 * SQL required:
 *   CREATE TABLE club_messages (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 *     sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 *     body text NOT NULL,
 *     created_at timestamptz DEFAULT now()
 *   );
 *   ALTER TABLE club_messages ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Members read" ON club_messages FOR SELECT TO authenticated
 *     USING (EXISTS (SELECT 1 FROM club_members WHERE club_id = club_messages.club_id AND user_id = auth.uid()));
 *   CREATE POLICY "Members send" ON club_messages FOR INSERT TO authenticated
 *     WITH CHECK (auth.uid() = sender_id AND
 *       EXISTS (SELECT 1 FROM club_members WHERE club_id = club_messages.club_id AND user_id = auth.uid()));
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Toast from 'react-native-toast-message'
import { supabase } from '../../lib/supabase'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'

interface RoomMessage {
  id: string
  club_id: string
  sender_id: string
  body: string
  created_at: string
  _optimistic?: boolean
  profiles?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export default function ClubRoomScreen() {
  const { id: clubId } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const listRef = useRef<FlatList>(null)

  const [myId, setMyId] = useState('')
  const [clubName, setClubName] = useState('')
  const [clubColor, setClubColor] = useState('#a78bfa')
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isMember, setIsMember] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !clubId) return
      setMyId(user.id)

      // Load club info
      const { data: club } = await supabase
        .from('clubs').select('name, color').eq('id', clubId).single()
      if (club) { setClubName(club.name); setClubColor(club.color ?? '#a78bfa') }

      // Check membership
      const { data: membership } = await supabase
        .from('club_members').select('role')
        .eq('club_id', clubId).eq('user_id', user.id).maybeSingle()
      setIsMember(!!membership)

      // Load recent messages
      const { data: msgs, error } = await supabase
        .from('club_messages')
        .select('*, profiles!sender_id(id, full_name, avatar_url)')
        .eq('club_id', clubId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error && error.code === '42P01') {
        // Table doesn't exist yet
        Toast.show({ type: 'info', text1: 'Chat not yet set up', text2: 'Run the club_messages SQL in Supabase first.' })
      }

      setMessages(msgs ?? [])
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100)
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }, [clubId])

  useEffect(() => { load() }, [load])

  // Realtime subscription
  useEffect(() => {
    if (!clubId) return
    const channel = supabase
      .channel(`club-room:${clubId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'club_messages',
        filter: `club_id=eq.${clubId}`,
      }, async (payload: any) => {
        const { data: profile } = await supabase
          .from('profiles').select('id, full_name, avatar_url')
          .eq('id', payload.new.sender_id).single()
        setMessages(prev => {
          const dup = prev.find(m => m._optimistic && m.body === payload.new.body && m.sender_id === payload.new.sender_id)
          if (dup) return prev.map(m => m === dup ? { ...payload.new, profiles: profile } : m)
          return [...prev, { ...payload.new, profiles: profile }]
        })
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [clubId])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !clubId || sending) return
    if (!isMember) {
      Toast.show({ type: 'info', text1: 'Join the club first', text2: 'You must be a member to chat.' })
      return
    }
    setInput('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const optimistic: RoomMessage = {
      id: `opt_${Date.now()}`, _optimistic: true,
      club_id: clubId, sender_id: myId,
      body: text, created_at: new Date().toISOString(), profiles: null,
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)

    setSending(true)
    const { error } = await supabase.from('club_messages').insert({
      club_id: clubId, sender_id: myId, body: text,
    })
    setSending(false)
    if (error) {
      setMessages(prev => prev.filter(m => m !== optimistic))
      Toast.show({ type: 'error', text1: 'Message failed', text2: error.message })
    }
  }

  const renderMessage = ({ item: m, index }: { item: RoomMessage; index: number }) => {
    const mine = m.sender_id === myId
    const prevMsg = messages[index - 1]
    const showHeader = !prevMsg || prevMsg.sender_id !== m.sender_id
    const name = m.profiles?.full_name ?? 'Member'

    return (
      <View style={[s.msgGroup, mine && s.msgGroupMine]}>
        {!mine && showHeader && (
          <View style={s.senderRow}>
            {m.profiles?.avatar_url ? (
              <Image source={{ uri: m.profiles.avatar_url }} style={s.senderAvatar} />
            ) : (
              <View style={[s.senderAvatarFallback, { backgroundColor: theme.card2 }]}>
                <Text style={[s.senderInitials, { color: clubColor }]}>{getInitials(name)}</Text>
              </View>
            )}
            <Text style={[s.senderName, { color: clubColor }]}>{name}</Text>
          </View>
        )}
        <View style={s.msgRow}>
          {!mine && <View style={{ width: 8 }} />}
          <View style={[
            s.bubble,
            mine
              ? [s.bubbleMine, { backgroundColor: clubColor }]
              : [s.bubbleTheirs, { backgroundColor: theme.card, borderColor: theme.border }],
            m._optimistic && { opacity: 0.65 },
          ]}>
            <Text style={[s.bubbleText, { color: mine ? '#fff' : theme.text }]}>{m.body}</Text>
            <Text style={[s.bubbleTime, { color: mine ? 'rgba(255,255,255,0.5)' : theme.textFaint }]}>
              {getTimeAgo(m.created_at)}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card2, borderColor: theme.border }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={[s.roomIconWrap, { backgroundColor: clubColor + '22', borderColor: clubColor + '44' }]}>
          <Ionicons name="people" size={16} color={clubColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.text }]} numberOfLines={1}>{clubName}</Text>
          <Text style={[s.headerSub, { color: theme.textFaint }]}>Club chat room</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {loading ? (
          <View style={s.loadingWrap}><ActivityIndicator color={clubColor} size="large" /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m, i) => m.id ?? `${i}`}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={48} color={theme.textFaint} />
                <Text style={[s.emptyText, { color: theme.textMuted }]}>
                  {isMember ? 'Start the conversation!' : 'Join the club to participate'}
                </Text>
              </View>
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input */}
        <View style={[s.inputRow, {
          borderTopColor: theme.border, backgroundColor: theme.card,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
        }]}>
          <TextInput
            style={[s.input, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text }]}
            placeholder={isMember ? 'Message the club...' : 'Join club to chat'}
            placeholderTextColor={theme.textFaint}
            value={input} onChangeText={setInput}
            multiline maxLength={500} editable={isMember}
            returnKeyType="send" onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[
              s.sendBtn,
              { backgroundColor: input.trim() && isMember ? clubColor : theme.card2, borderColor: theme.border },
              (!input.trim() || !isMember || sending) && { opacity: 0.4 },
            ]}
            onPress={sendMessage} disabled={!input.trim() || !isMember || sending}>
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={16} color={input.trim() && isMember ? '#fff' : theme.textFaint} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  roomIconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  headerTitle: { fontSize: 15, fontFamily: typography.fontSemiBold },
  headerSub: { fontSize: 11, fontFamily: typography.fontRegular, marginTop: 1 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: typography.fontRegular, textAlign: 'center' },

  msgGroup: { marginBottom: 4 },
  msgGroupMine: { alignItems: 'flex-end' },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, marginLeft: 8 },
  senderAvatar: { width: 22, height: 22, borderRadius: 11 },
  senderAvatarFallback: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  senderInitials: { fontSize: 9, fontFamily: typography.fontBold },
  senderName: { fontSize: 11, fontFamily: typography.fontSemiBold },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, gap: 2 },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleTheirs: { borderBottomLeftRadius: 4, borderWidth: 0.5 },
  bubbleText: { fontSize: 14, fontFamily: typography.fontRegular, lineHeight: 20 },
  bubbleTime: { fontSize: 9, fontFamily: typography.fontRegular, alignSelf: 'flex-end' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 10, paddingTop: 10, borderTopWidth: 0.5,
  },
  input: {
    flex: 1, borderRadius: 22, paddingHorizontal: 14,
    paddingTop: 10, paddingBottom: 10, fontSize: 14,
    fontFamily: typography.fontRegular, borderWidth: 0.5, maxHeight: 120,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
})
