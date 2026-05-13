/**
 * app/study-room/[id].tsx
 * Real-time group chat for a study group.
 *
 * SQL required:
 *   CREATE TABLE study_group_messages (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     group_id uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
 *     sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 *     body text NOT NULL,
 *     created_at timestamptz DEFAULT now()
 *   );
 *   ALTER TABLE study_group_messages ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Members read" ON study_group_messages FOR SELECT TO authenticated
 *     USING (EXISTS (SELECT 1 FROM study_group_members WHERE group_id = study_group_messages.group_id AND user_id = auth.uid()));
 *   CREATE POLICY "Members send" ON study_group_messages FOR INSERT TO authenticated
 *     WITH CHECK (auth.uid() = sender_id AND
 *       EXISTS (SELECT 1 FROM study_group_members WHERE group_id = study_group_messages.group_id AND user_id = auth.uid()));
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

const ROOM_COLOR = '#60a5fa'

interface RoomMessage {
  id: string
  group_id: string
  sender_id: string
  body: string
  created_at: string
  _optimistic?: boolean
  profiles?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export default function StudyRoomScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const listRef = useRef<FlatList>(null)

  const [myId, setMyId] = useState('')
  const [groupName, setGroupName] = useState('Study Room')
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isMember, setIsMember] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !groupId) { setLoading(false); return }
    setMyId(user.id)

    // Load group info
    const { data: groups } = await supabase
      .from('study_groups').select('name').eq('id', groupId).single()
    if (groups) setGroupName(groups.name)

    // Check membership
    const { data: membership } = await supabase
      .from('study_group_members').select('user_id')
      .eq('group_id', groupId).eq('user_id', user.id).maybeSingle()
    setIsMember(!!membership)

    // Load messages
    const { data: msgs, error } = await supabase
      .from('study_group_messages')
      .select('*, profiles(id, full_name, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error && error.code === '42P01') {
      Toast.show({ type: 'info', text1: 'Run study_group_messages SQL', text2: 'Check code comments.' })
    }
    setMessages(msgs ?? [])
    setLoading(false)
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100)
  }, [groupId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!groupId) return
    const channel = supabase
      .channel(`study-room:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'study_group_messages',
        filter: `group_id=eq.${groupId}`,
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
  }, [groupId])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !groupId || sending) return
    if (!isMember) {
      Toast.show({ type: 'info', text1: 'Join the group first' }); return
    }
    setInput('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const optimistic: RoomMessage = {
      id: `opt_${Date.now()}`, _optimistic: true,
      group_id: groupId, sender_id: myId,
      body: text, created_at: new Date().toISOString(), profiles: null,
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
    setSending(true)
    const { error } = await supabase.from('study_group_messages').insert({
      group_id: groupId, sender_id: myId, body: text,
    })
    setSending(false)
    if (error) {
      setMessages(prev => prev.filter(m => m !== optimistic))
      Toast.show({ type: 'error', text1: 'Message failed', text2: error.message })
    }
  }

  const renderMessage = ({ item: m, index }: { item: RoomMessage; index: number }) => {
    const mine = m.sender_id === myId
    const prev = messages[index - 1]
    const showHeader = !prev || prev.sender_id !== m.sender_id
    const name = m.profiles?.full_name ?? 'Member'

    return (
      <View style={[s.msgGroup, mine && s.msgGroupMine]}>
        {!mine && showHeader && (
          <View style={s.senderRow}>
            {m.profiles?.avatar_url ? (
              <Image source={{ uri: m.profiles.avatar_url }} style={s.senderAvatar} />
            ) : (
              <View style={[s.senderAvatarFallback, { backgroundColor: theme.card2 }]}>
                <Text style={[s.senderInitials, { color: ROOM_COLOR }]}>{getInitials(name)}</Text>
              </View>
            )}
            <Text style={[s.senderName, { color: ROOM_COLOR }]}>{name}</Text>
          </View>
        )}
        <View style={s.msgRow}>
          {!mine && <View style={{ width: 8 }} />}
          <View style={[
            s.bubble,
            mine ? [s.bubbleMine, { backgroundColor: ROOM_COLOR }]
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
      <View style={[s.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card2, borderColor: theme.border }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={[s.roomIconWrap, { backgroundColor: ROOM_COLOR + '22', borderColor: ROOM_COLOR + '44' }]}>
          <Ionicons name="book-outline" size={16} color={ROOM_COLOR} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.text }]} numberOfLines={1}>{groupName}</Text>
          <Text style={[s.headerSub, { color: theme.textFaint }]}>Study room chat</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {loading ? (
          <View style={s.loadingWrap}><ActivityIndicator color={ROOM_COLOR} size="large" /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m, i) => m.id ?? `${i}`}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={48} color={theme.textFaint} />
                <Text style={[s.emptyText, { color: theme.textMuted }]}>
                  {isMember ? 'Start the discussion!' : 'Join the group to chat'}
                </Text>
              </View>
            }
          />
        )}
        <View style={[s.inputRow, {
          borderTopColor: theme.border, backgroundColor: theme.card,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
        }]}>
          <TextInput
            style={[s.input, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text }]}
            placeholder={isMember ? 'Message the group...' : 'Join to chat'}
            placeholderTextColor={theme.textFaint}
            value={input} onChangeText={setInput}
            multiline maxLength={500} editable={isMember}
            returnKeyType="send" onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[s.sendBtn, {
              backgroundColor: input.trim() && isMember ? ROOM_COLOR : theme.card2,
              borderColor: theme.border,
            }, (!input.trim() || !isMember || sending) && { opacity: 0.4 }]}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  roomIconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  headerTitle: { fontSize: 15, fontFamily: typography.fontSemiBold },
  headerSub: { fontSize: 11, fontFamily: typography.fontRegular, marginTop: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
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
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 10, borderTopWidth: 0.5 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 14, fontFamily: typography.fontRegular, borderWidth: 0.5, maxHeight: 120 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
})
