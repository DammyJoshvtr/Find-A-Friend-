/**
 * app/study-group/[id].tsx
 * Study group detail — Discussion | Members | Info tabs.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  getStudyGroups, joinStudyGroup, leaveStudyGroup,
  getStudyGroupMessages, sendStudyGroupMessage,
} from '../../lib/academic'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { supabase } from '../../lib/supabase'
import type { StudyGroup, CourseDiscussion } from '../../lib/academic'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'

type Tab = 'discussion' | 'members' | 'info'

interface GroupMember {
  user_id: string
  joined_at: string
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
    department: string | null
  } | null
}

export default function StudyGroupDetailScreen() {
  const theme = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [group, setGroup] = useState<StudyGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('discussion')

  const [discussions, setDiscussions] = useState<CourseDiscussion[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  const [isMember, setIsMember] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)

  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (id) loadGroup()
  }, [id])

  useEffect(() => {
    if (id && group) loadTabData(activeTab)
  }, [activeTab, group])

  useEffect(() => {
    if (!id) return

    // 1. Subscribe to study_groups UPDATE events to sync member counts etc.
    const groupChannel = supabase
      .channel(`study-group-detail-realtime-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'study_groups', filter: `id=eq.${id}` },
        (payload: any) => {
          const updated = payload.new as StudyGroup
          setGroup(g => g ? { ...g, ...updated, courses: g.courses } : updated)
        }
      )
      .subscribe()

    // 2. Subscribe to study_group_members events to sync user's join status and member lists
    const membersChannel = supabase
      .channel(`study-group-members-realtime-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_group_members', filter: `group_id=eq.${id}` },
        async () => {
          // Recheck membership
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: membership } = await supabase
              .from('study_group_members')
              .select('user_id')
              .eq('group_id', id)
              .eq('user_id', user.id)
              .maybeSingle()
            setIsMember(!!membership)
          }
          // Reload the members list
          loadTabData('members')
        }
      )
      .subscribe()

    // 3. Subscribe to study_group_messages INSERT events to prepend new discussions
    const messagesChannel = supabase
      .channel(`study-group-messages-realtime-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'study_group_messages', filter: `group_id=eq.${id}` },
        async (payload: any) => {
          // Fetch profile of the sender
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single()

          const messageWithProfile = {
            ...payload.new,
            profiles: profile
          }

          setDiscussions(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [messageWithProfile, ...prev]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(groupChannel)
      supabase.removeChannel(membersChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [id])

  const loadGroup = async () => {
    setLoading(true)
    try {
      // Fetch all groups and find the one with matching id
      const { data } = await getStudyGroups()
      const found = (data ?? []).find(g => g.id === id) ?? null
      setGroup(found)

      // Check membership
      const { data: { user } } = await supabase.auth.getUser()
      if (user && found) {
        const { data: membership } = await supabase
          .from('study_group_members')
          .select('user_id')
          .eq('group_id', id)
          .eq('user_id', user.id)
          .maybeSingle()
        setIsMember(!!membership)
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }

  const loadTabData = async (tab: Tab) => {
    setTabLoading(true)
    if (tab === 'discussion') {
      const { data } = await getStudyGroupMessages(id)
      setDiscussions(data ?? [])
    } else if (tab === 'members') {
      const { data, error } = await supabase
        .from('study_group_members')
        .select('user_id, joined_at, profiles(id, full_name, avatar_url, department)')
        .eq('group_id', id)
        .order('joined_at', { ascending: true })
      if (!error) {
        const mapped = (data ?? []).map((item: any) => ({
          ...item,
          profiles: Array.isArray(item.profiles) ? (item.profiles[0] ?? null) : (item.profiles ?? null)
        }))
        setMembers(mapped as GroupMember[])
      }
    }
    setTabLoading(false)
  }

  const handleJoinLeave = async () => {
    if (!group) return
    setJoinLoading(true)
    if (isMember) {
      setIsMember(false)
      setGroup(g => g ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g)
      const { error } = await leaveStudyGroup(id)
      if (error) {
        setIsMember(true)
        setGroup(g => g ? { ...g, member_count: (g.member_count ?? 0) + 1 } : g)
        Alert.alert('Error', 'Could not leave group.')
      }
    } else {
      const isFull = group.max_members != null && group.member_count >= group.max_members
      if (isFull) { setJoinLoading(false); return }
      setIsMember(true)
      setGroup(g => g ? { ...g, member_count: (g.member_count ?? 0) + 1 } : g)
      const { error } = await joinStudyGroup(id)
      if (error) {
        setIsMember(false)
        setGroup(g => g ? { ...g, member_count: Math.max(0, (g.member_count ?? 1) - 1) } : g)
        Alert.alert('Error', error.message)
      }
    }
    setJoinLoading(false)
    if (activeTab === 'members') loadTabData('members')
  }

  const handlePost = async () => {
    if (!commentText.trim()) return
    setPosting(true)
    const { data, error } = await sendStudyGroupMessage(id, commentText.trim())
    setPosting(false)
    if (error) {
      Alert.alert('Error', 'Could not post. Please try again.')
    } else if (data) {
      setDiscussions(prev => {
        if (prev.some(m => m.id === data.id)) return prev
        return [data, ...prev]
      })
      setCommentText('')
    }
  }

  const onRefresh = useCallback(() => {
    if (group) loadTabData(activeTab)
  }, [activeTab, group])

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      </SafeAreaView>
    )
  }

  if (!group) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <Text style={s.errorText}>Group not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={s.retryBtn}>
            <Text style={s.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const isFull = group.max_members != null && group.member_count >= group.max_members

  const renderTabContent = () => {
    if (tabLoading) {
      return <ActivityIndicator color={theme.accent} style={{ marginTop: 30 }} />
    }

    if (activeTab === 'discussion') {
      if (!isMember) {
        return (
          <View style={[s.lockedContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[s.lockCircle, { backgroundColor: theme.accentBg }]}>
              <Ionicons name="lock-closed" size={32} color={theme.accent} />
            </View>
            <Text style={[s.lockedTitle, { color: theme.text, fontFamily: typography.fontBold }]}>Discussion Locked</Text>
            <Text style={[s.lockedSubtitle, { color: theme.textMuted, fontFamily: typography.fontRegular }]}>
              Join this study group to view and participate in the discussions.
            </Text>
            <TouchableOpacity
              style={[s.lockedJoinBtn, { backgroundColor: theme.accent }]}
              onPress={handleJoinLeave}
              disabled={joinLoading || isFull}>
              {joinLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.lockedJoinText}>{isFull ? 'Group Full' : 'Join Study Group'}</Text>
              )}
            </TouchableOpacity>
          </View>
        )
      }

      return (
        <FlatList
          data={discussions}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[s.discussionCard, { borderBottomColor: theme.border2 }]}>
              <View style={[s.discussionAvatar, { backgroundColor: theme.card2 }]}>
                {item.profiles?.avatar_url ? (
                  <Image source={{ uri: item.profiles.avatar_url }} style={s.discussionAvatarImg} />
                ) : (
                  <Text style={[s.discussionInitials, { color: theme.accent }]}>
                    {getInitials(item.profiles?.full_name ?? '??')}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.discussionHeader}>
                  <Text style={[s.discussionAuthor, { color: theme.text, fontFamily: typography.fontSemiBold }]}>{item.profiles?.full_name ?? 'Student'}</Text>
                  <Text style={[s.discussionTime, { color: theme.textFaint }]}>{getTimeAgo(item.created_at)}</Text>
                </View>
                <Text style={[s.discussionBody, { color: theme.text, opacity: 0.85, fontFamily: typography.fontRegular }]}>{item.body}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="chatbubble-outline" size={36} color={theme.textFaint} />
              <Text style={[s.emptyText, { color: theme.textMuted, fontFamily: typography.fontRegular }]}>
                No discussions yet
              </Text>
            </View>
          }
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        />
      )
    }

    if (activeTab === 'members') {
      return (
        <FlatList
          data={members}
          keyExtractor={item => item.user_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.memberRow, { borderBottomColor: theme.border2 }]}
              onPress={() => router.push(`/profile/${item.user_id}` as any)}>
              <View style={[s.memberAvatar, { backgroundColor: theme.card2 }]}>
                {item.profiles?.avatar_url ? (
                  <Image source={{ uri: item.profiles.avatar_url }} style={s.memberAvatarImg} />
                ) : (
                  <Text style={[s.memberInitials, { color: theme.accent }]}>
                    {getInitials(item.profiles?.full_name ?? '??')}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.memberName, { color: theme.text, fontFamily: typography.fontMedium }]}>{item.profiles?.full_name ?? 'Member'}</Text>
                {item.profiles?.department && (
                  <Text style={[s.memberDept, { color: theme.textMuted }]}>{item.profiles.department}</Text>
                )}
              </View>
              <Text style={[s.joinedAt, { color: theme.textFaint }]}>{getTimeAgo(item.joined_at)}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={36} color={theme.textFaint} />
              <Text style={[s.emptyText, { color: theme.textMuted, fontFamily: typography.fontRegular }]}>No members yet</Text>
            </View>
          }
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        />
      )
    }

    // Info tab
    return (
      <View style={s.infoSection}>
        {group.description && (
          <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.infoLabel, { color: theme.textFaint, fontFamily: typography.fontSemiBold }]}>About</Text>
            <Text style={[s.infoValue, { color: theme.text, fontFamily: typography.fontRegular }]}>{group.description}</Text>
          </View>
        )}
        {group.courses && (
          <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.infoLabel, { color: theme.textFaint, fontFamily: typography.fontSemiBold }]}>Linked Course</Text>
            <Text style={[s.infoValue, { color: theme.text, fontFamily: typography.fontRegular }]}>{group.courses.code} — {group.courses.name}</Text>
          </View>
        )}
        {group.venue && (
          <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.infoLabel, { color: theme.textFaint, fontFamily: typography.fontSemiBold }]}>Venue</Text>
            <View style={s.infoRow}>
              <Ionicons name="location-outline" size={14} color={theme.textMuted} />
              <Text style={[s.infoValue, { color: theme.text, fontFamily: typography.fontRegular }]}>{group.venue}</Text>
            </View>
          </View>
        )}
        {group.meet_time && (
          <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.infoLabel, { color: theme.textFaint, fontFamily: typography.fontSemiBold }]}>Meeting Time</Text>
            <View style={s.infoRow}>
              <Ionicons name="time-outline" size={14} color={theme.textMuted} />
              <Text style={[s.infoValue, { color: theme.text, fontFamily: typography.fontRegular }]}>{group.meet_time}</Text>
              {group.is_recurring && (
                <Text style={[s.recurringBadge, { color: theme.success, backgroundColor: theme.dark ? 'rgba(52,211,153,0.12)' : 'rgba(16,185,129,0.12)' }]}>Recurring</Text>
              )}
            </View>
          </View>
        )}
        <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[s.infoLabel, { color: theme.textFaint, fontFamily: typography.fontSemiBold }]}>Members</Text>
          <Text style={[s.infoValue, { color: theme.text, fontFamily: typography.fontRegular }]}>
            {group.member_count}{group.max_members ? ` / ${group.max_members}` : ''} members
          </Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>

        {/* Header */}
        <View style={[s.header, { borderBottomColor: theme.border2 }]}>
          <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={[s.groupName, { color: theme.text, fontFamily: typography.fontBold }]} numberOfLines={1}>{group.name}</Text>
            {group.courses && (
              <Text style={[s.groupCourse, { color: theme.accent, fontFamily: typography.fontMedium }]}>{group.courses.code}</Text>
            )}
          </View>
          <TouchableOpacity
            style={[
              s.joinBtn,
              { backgroundColor: theme.accent },
              isMember && { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)' },
              (isFull && !isMember) && { backgroundColor: theme.border, opacity: 0.5 }
            ]}
            onPress={handleJoinLeave}
            disabled={joinLoading || (isFull && !isMember)}>
            {joinLoading
              ? <ActivityIndicator size="small" color={isMember ? theme.danger : '#fff'} />
              : <Text style={[
                  s.joinText,
                  { color: '#fff', fontFamily: typography.fontSemiBold },
                  isMember && { color: theme.danger }
                ]}>
                  {isMember ? 'Leave' : isFull ? 'Full' : 'Join'}
                </Text>}
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={[s.tabBar, { borderBottomColor: theme.border2 }]}>
          {(['discussion', 'members', 'info'] as Tab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                s.tab,
                { backgroundColor: theme.card, borderColor: theme.border },
                activeTab === tab && { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }
              ]}
              onPress={() => setActiveTab(tab)}>
              <Text style={[
                s.tabText,
                { color: theme.textMuted, fontFamily: typography.fontMedium },
                activeTab === tab && { color: theme.accent, fontFamily: typography.fontBold }
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <FlatList
          data={[]}
          keyExtractor={() => 'empty'}
          renderItem={() => null}
          ListHeaderComponent={renderTabContent()}
          scrollEnabled
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
          onRefresh={onRefresh}
          refreshing={false}
        />

        {/* Discussion input */}
        {activeTab === 'discussion' && isMember && (
          <View style={[s.inputBar, { borderTopColor: theme.border2, backgroundColor: theme.bg }]}>
            <TextInput
              style={[s.inputField, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Add to discussion..."
              placeholderTextColor={theme.textFaint}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={400}
            />
            <TouchableOpacity
              style={[s.sendBtn, { backgroundColor: theme.accent }, !commentText.trim() && s.sendBtnDisabled]}
              onPress={handlePost}
              disabled={posting || !commentText.trim()}>
              {posting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centeredWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  retryBtn: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13, color: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  groupName: { fontSize: 15, fontWeight: '700' },
  groupCourse: { fontSize: 11, marginTop: 1 },
  joinBtn: {
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, minWidth: 52, alignItems: 'center',
  },
  leaveBtn: {
    borderWidth: 0.5,
  },
  fullBtn: { opacity: 0.5 },
  joinText: { fontSize: 12, fontWeight: '600' },
  leaveText: {},
  tabBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    gap: 8, borderBottomWidth: 0.5,
  },
  tab: {
    flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: 'center',
    borderWidth: 0.5,
  },
  tabActive: {},
  tabText: { fontSize: 11 },
  tabTextActive: {},
  // Discussion
  discussionCard: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  discussionAvatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  discussionAvatarImg: { width: 34, height: 34, borderRadius: 17 },
  discussionInitials: { fontSize: 10, fontWeight: '700' },
  discussionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  discussionAuthor: { fontSize: 12 },
  discussionTime: { fontSize: 10 },
  discussionBody: { fontSize: 13, lineHeight: 18 },
  // Members
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  memberAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  memberInitials: { fontSize: 11, fontWeight: '700' },
  memberName: { fontSize: 13, marginBottom: 1 },
  memberDept: { fontSize: 11 },
  joinedAt: { fontSize: 10 },
  // Info
  infoSection: { paddingHorizontal: 16, paddingTop: 8 },
  infoCard: {
    borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 0.5,
  },
  infoLabel: { fontSize: 10, marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoValue: { fontSize: 13, lineHeight: 18 },
  recurringBadge: {
    fontSize: 9, fontWeight: '600',
    borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13 },
  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 0.5,
  },
  inputField: {
    flex: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, maxHeight: 80,
    borderWidth: 0.5,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  // Locked discussion prompt
  lockedContainer: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  lockedTitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  lockedSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  lockedJoinBtn: {
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedJoinText: {
    fontSize: 13,
    color: '#fff',
  },
})
