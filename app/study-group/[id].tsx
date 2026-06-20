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
  getCourseDiscussions, createAcademicPost,
} from '../../lib/academic'
import { getInitials, getTimeAgo } from '../../lib/matching'
// import { supabase } from '../../lib/supabase'
import type { StudyGroup, CourseDiscussion } from '../../lib/academic'
import { useTheme } from '../../lib/theme'
import { getCurrentUser } from 'aws-amplify/auth'
import { client } from '../../lib/aws'
import { useAcademicStore } from '../../store/academicStore'

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

  const loadGroup = async () => {
    setLoading(true)
    try {
      // Fetch all groups and find the one with matching id
      const { data } = await getStudyGroups()
      const found = (data ?? []).find(g => g.id === id) ?? null
      setGroup(found)

      // Check membership
      let user;
      try { user = await getCurrentUser() } catch {}
      if (user && found) {
        const { data: membership } = await client.models.StudyGroupMember.list({
          filter: { group_id: { eq: id }, user_id: { eq: user.userId } }
        })
        setIsMember(membership && membership.length > 0)
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }

  const loadTabData = async (tab: Tab) => {
    setTabLoading(true)
    if (tab === 'discussion' && group?.course_id) {
      const { data } = await getCourseDiscussions(group.course_id)
      setDiscussions(data ?? [])
    } else if (tab === 'discussion') {
      setDiscussions([])
    } else if (tab === 'members') {
      const { data, errors: error } = await client.models.StudyGroupMember.list({
        filter: { group_id: { eq: id } }
      })
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
    const { optimisticJoinGroup, optimisticLeaveGroup } = useAcademicStore.getState()

    setJoinLoading(true)
    if (isMember) {
      setIsMember(false)
      setGroup(g => g ? { ...g, member_count: Math.max(0, (g.member_count ?? 1) - 1) } : g)
      optimisticLeaveGroup(id)
      const { error } = await leaveStudyGroup(id)
      if (error) {
        setIsMember(true)
        setGroup(g => g ? { ...g, member_count: (g.member_count ?? 0) + 1 } : g)
        optimisticJoinGroup(id)
        Alert.alert('Error', 'Could not leave group.')
      }
    } else {
      const isFull = group.max_members != null && group.member_count >= group.max_members
      if (isFull) { setJoinLoading(false); return }
      setIsMember(true)
      setGroup(g => g ? { ...g, member_count: (g.member_count ?? 0) + 1 } : g)
      optimisticJoinGroup(id)
      const { error } = await joinStudyGroup(id)
      if (error) {
        setIsMember(false)
        setGroup(g => g ? { ...g, member_count: Math.max(0, (g.member_count ?? 1) - 1) } : g)
        optimisticLeaveGroup(id)
        Alert.alert('Error', error.message)
      }
    }
    setJoinLoading(false)
    if (activeTab === 'members') loadTabData('members')
  }

  const handlePost = async () => {
    if (!commentText.trim() || !group?.course_id) return
    setPosting(true)
    const { data, error } = await createAcademicPost(group.course_id, commentText.trim())
    setPosting(false)
    if (error) {
      Alert.alert('Error', 'Could not post. Please try again.')
    } else if (data) {
      setDiscussions(prev => [data, ...prev])
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
      return <ActivityIndicator color="#a78bfa" style={{ marginTop: 30 }} />
    }

    if (activeTab === 'discussion') {
      return (
        <FlatList
          data={discussions}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={s.discussionCard}>
              <View style={s.discussionAvatar}>
                {item.profiles?.avatar_url ? (
                  <Image source={{ uri: item.profiles.avatar_url }} style={s.discussionAvatarImg} />
                ) : (
                  <Text style={s.discussionInitials}>
                    {getInitials(item.profiles?.full_name ?? '??')}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.discussionHeader}>
                  <Text style={s.discussionAuthor}>{item.profiles?.full_name ?? 'Student'}</Text>
                  <Text style={s.discussionTime}>{getTimeAgo(item.created_at)}</Text>
                </View>
                <Text style={s.discussionBody}>{item.body}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="chatbubble-outline" size={36} color="rgba(240,240,255,0.1)" />
              <Text style={s.emptyText}>
                {group.course_id ? 'No discussions yet' : 'Discussion requires a linked course'}
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
              style={s.memberRow}
              onPress={() => router.push(`/profile/${item.user_id}` as any)}>
              <View style={s.memberAvatar}>
                {item.profiles?.avatar_url ? (
                  <Image source={{ uri: item.profiles.avatar_url }} style={s.memberAvatarImg} />
                ) : (
                  <Text style={s.memberInitials}>
                    {getInitials(item.profiles?.full_name ?? '??')}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.memberName}>{item.profiles?.full_name ?? 'Member'}</Text>
                {item.profiles?.department && (
                  <Text style={s.memberDept}>{item.profiles.department}</Text>
                )}
              </View>
              <Text style={s.joinedAt}>{getTimeAgo(item.joined_at)}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={36} color="rgba(240,240,255,0.1)" />
              <Text style={s.emptyText}>No members yet</Text>
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
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>About</Text>
            <Text style={s.infoValue}>{group.description}</Text>
          </View>
        )}
        {group.courses && (
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>Linked Course</Text>
            <Text style={s.infoValue}>{group.courses.code} — {group.courses.name}</Text>
          </View>
        )}
        {group.venue && (
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>Venue</Text>
            <View style={s.infoRow}>
              <Ionicons name="location-outline" size={14} color="rgba(240,240,255,0.5)" />
              <Text style={s.infoValue}>{group.venue}</Text>
            </View>
          </View>
        )}
        {group.meet_time && (
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>Meeting Time</Text>
            <View style={s.infoRow}>
              <Ionicons name="time-outline" size={14} color="rgba(240,240,255,0.5)" />
              <Text style={s.infoValue}>{group.meet_time}</Text>
              {group.is_recurring && (
                <Text style={s.recurringBadge}>Recurring</Text>
              )}
            </View>
          </View>
        )}
        <View style={s.infoCard}>
          <Text style={s.infoLabel}>Members</Text>
          <Text style={s.infoValue}>
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
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#f0f0ff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={s.groupName} numberOfLines={1}>{group.name}</Text>
            {group.courses && (
              <Text style={s.groupCourse}>{group.courses.code}</Text>
            )}
          </View>
          <TouchableOpacity
            style={[s.joinBtn, isMember && s.leaveBtn, (isFull && !isMember) && s.fullBtn]}
            onPress={handleJoinLeave}
            disabled={joinLoading || (isFull && !isMember)}>
            {joinLoading
              ? <ActivityIndicator size="small" color={isMember ? '#ef4444' : '#fff'} />
              : <Text style={[s.joinText, isMember && s.leaveText]}>
                  {isMember ? 'Leave' : isFull ? 'Full' : 'Join'}
                </Text>}
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {(['discussion', 'members', 'info'] as Tab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => setActiveTab(tab)}>
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
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
        {activeTab === 'discussion' && group.course_id && isMember && (
          <View style={s.inputBar}>
            <TextInput
              style={s.inputField}
              placeholder="Add to discussion..."
              placeholderTextColor="rgba(240,240,255,0.3)"
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={400}
            />
            <TouchableOpacity
              style={[s.sendBtn, !commentText.trim() && s.sendBtnDisabled]}
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
  retryBtn: { backgroundColor: '#a78bfa', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  groupName: { fontSize: 15, fontWeight: '700', color: '#f0f0ff' },
  groupCourse: { fontSize: 11, color: '#60a5fa', marginTop: 1 },
  joinBtn: {
    backgroundColor: '#60a5fa', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, minWidth: 52, alignItems: 'center',
  },
  leaveBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)',
  },
  fullBtn: { backgroundColor: 'rgba(255,255,255,0.06)', opacity: 0.5 },
  joinText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  leaveText: { color: '#ef4444' },
  tabBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    gap: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tab: {
    flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: 'center',
    backgroundColor: '#1c1c2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  tabText: { fontSize: 11, color: 'rgba(240,240,255,0.4)', fontWeight: '500' },
  tabTextActive: { color: '#a78bfa', fontWeight: '700' },
  // Discussion
  discussionCard: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  discussionAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#2a1e40', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  discussionAvatarImg: { width: 34, height: 34, borderRadius: 17 },
  discussionInitials: { fontSize: 10, fontWeight: '700', color: '#c4b5fd' },
  discussionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  discussionAuthor: { fontSize: 12, fontWeight: '600', color: '#f0f0ff' },
  discussionTime: { fontSize: 10, color: 'rgba(240,240,255,0.35)' },
  discussionBody: { fontSize: 13, color: 'rgba(240,240,255,0.7)', lineHeight: 18 },
  // Members
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  memberAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#2a1e40', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  memberInitials: { fontSize: 11, fontWeight: '700', color: '#c4b5fd' },
  memberName: { fontSize: 13, fontWeight: '500', color: '#f0f0ff', marginBottom: 1 },
  memberDept: { fontSize: 11, color: 'rgba(240,240,255,0.35)' },
  joinedAt: { fontSize: 10, color: 'rgba(240,240,255,0.3)' },
  // Info
  infoSection: { paddingHorizontal: 16, paddingTop: 8 },
  infoCard: {
    backgroundColor: '#1c1c2e', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  infoLabel: { fontSize: 10, color: 'rgba(240,240,255,0.35)', marginBottom: 6, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoValue: { fontSize: 13, color: '#f0f0ff', lineHeight: 18 },
  recurringBadge: {
    fontSize: 9, color: '#34d399', fontWeight: '600',
    backgroundColor: 'rgba(52,211,153,0.12)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.3)' },
  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  inputField: {
    flex: 1, backgroundColor: '#1c1c2e', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, color: '#f0f0ff', maxHeight: 80,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#60a5fa', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
})
