/**
 * app/club/[id].tsx
 * Club detail — header + tab bar: Feed | Announcements | Members | Events.
 */
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  TouchableOpacity, Image, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  getClubDetail, getMyClubRole, joinClub, leaveClub,
  getClubPosts, getClubAnnouncements, getClubMembers, getClubEvents,
} from '../../lib/clubs'
import PostCard from '../../components/feed/PostCard'
import EventCard from '../../components/events/EventCard'
import { getInitials, getTimeAgo } from '../../lib/matching'
import type { Club, ClubMember, ClubAnnouncement } from '../../lib/clubs'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import type { FeedPost } from '../../lib/feed'
import type { Event } from '../../lib/events'

type Tab = 'feed' | 'announcements' | 'members' | 'events'

const TABS: { label: string; value: Tab }[] = [
  { label: 'Feed', value: 'feed' },
  { label: 'Announcements', value: 'announcements' },
  { label: 'Members', value: 'members' },
  { label: 'Events', value: 'events' },
]

export default function ClubDetailScreen() {
  const theme = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [club, setClub] = useState<Club | null>(null)
  const [role, setRole] = useState<'member' | 'moderator' | 'admin' | null>(null)
  const [loading, setLoading] = useState(true)
  const [joinLoading, setJoinLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('feed')

  const [posts, setPosts] = useState<FeedPost[]>([])
  const [announcements, setAnnouncements] = useState<ClubAnnouncement[]>([])
  const [members, setMembers] = useState<ClubMember[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  useEffect(() => {
    if (id) loadHeader()
  }, [id])

  useEffect(() => {
    if (id) loadTabData(activeTab)
  }, [activeTab, id])

  const loadHeader = async () => {
    setLoading(true)
    try {
      const [clubRes, myRole] = await Promise.all([
        getClubDetail(id),
        getMyClubRole(id),
      ])
      setClub(clubRes.data)
      setRole(myRole)
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }

  const loadTabData = async (tab: Tab) => {
    setTabLoading(true)
    try {
      switch (tab) {
        case 'feed': {
          const { data } = await getClubPosts(id)
          setPosts(data ?? [])
          break
        }
        case 'announcements': {
          const { data } = await getClubAnnouncements(id)
          setAnnouncements(data ?? [])
          break
        }
        case 'members': {
          const { data } = await getClubMembers(id)
          setMembers(data ?? [])
          break
        }
        case 'events': {
          const { data } = await getClubEvents(id)
          setEvents(data ?? [])
          break
        }
      }
    } catch {
      // Non-fatal — keep existing tab data
    } finally {
      setTabLoading(false)
    }
  }

  const handleJoinLeave = async () => {
    if (!club) return
    setJoinLoading(true)
    if (role) {
      const { error } = await leaveClub(club.id)
      if (!error) {
        setRole(null)
        setClub(c => c ? { ...c, member_count: Math.max(0, c.member_count - 1) } : c)
      }
    } else {
      const { error } = await joinClub(club.id)
      if (!error) {
        setRole('member')
        setClub(c => c ? { ...c, member_count: c.member_count + 1 } : c)
      }
    }
    setJoinLoading(false)
  }

  const renderTabContent = () => {
    if (tabLoading) return <ActivityIndicator color="#a78bfa" style={{ marginTop: 30 }} />

    switch (activeTab) {
      case 'feed':
        return (
          <FlatList
            data={posts}
            keyExtractor={i => i.id}
            renderItem={({ item }) => <PostCard post={item} />}
            ListEmptyComponent={<EmptyTab message="No posts yet" />}
            scrollEnabled={false}
          />
        )
      case 'announcements':
        return (
          <FlatList
            data={announcements}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <View style={s.announcementCard}>
                <View style={s.announcementHeader}>
                  <View style={s.announcementAvatar}>
                    <Text style={s.announcementInitials}>
                      {getInitials(item.profiles?.full_name ?? '??')}
                    </Text>
                  </View>
                  <View>
                    <Text style={s.announcementAuthor}>{item.profiles?.full_name ?? 'Moderator'}</Text>
                    <Text style={s.announcementTime}>{getTimeAgo(item.created_at)}</Text>
                  </View>
                </View>
                <Text style={s.announcementBody}>{item.body}</Text>
              </View>
            )}
            ListEmptyComponent={<EmptyTab message="No announcements" />}
            scrollEnabled={false}
          />
        )
      case 'members':
        return (
          <FlatList
            data={members}
            keyExtractor={i => `${i.club_id}-${i.user_id}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.memberRow}
                onPress={() => router.push(`/profile/${item.user_id}` as any)}>
                <View style={s.memberAvatar}>
                  {item.profiles?.avatar_url ? (
                    <Image source={{ uri: item.profiles.avatar_url }} style={s.memberAvatarImg} />
                  ) : (
                    <Text style={s.memberInitials}>{getInitials(item.profiles?.full_name ?? '??')}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>{item.profiles?.full_name ?? 'Member'}</Text>
                  <Text style={s.memberDept}>{item.profiles?.department ?? ''}</Text>
                </View>
                {item.role !== 'member' && (
                  <View style={s.roleBadge}>
                    <Text style={s.roleText}>{item.role}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<EmptyTab message="No members yet" />}
            scrollEnabled={false}
          />
        )
      case 'events':
        return (
          <FlatList
            data={events}
            keyExtractor={i => i.id}
            renderItem={({ item }) => <EventCard event={item} />}
            ListEmptyComponent={<EmptyTab message="No events scheduled" />}
            scrollEnabled={false}
          />
        )
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      </SafeAreaView>
    )
  }

  if (!club) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>Club not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={s.retryBtn}>
            <Text style={s.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Cover image */}
        <View style={s.heroWrap}>
          {club.cover_url ? (
            <Image source={{ uri: club.cover_url }} style={s.hero} resizeMode="cover" />
          ) : (
            <View style={[s.hero, { backgroundColor: club.color + '22', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="people-outline" size={48} color={club.color || '#a78bfa'} />
            </View>
          )}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Club info */}
        <View style={s.infoRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.clubName}>{club.name}</Text>
            <Text style={s.clubMeta}>
              {club.category} · {club.member_count} members
            </Text>
          </View>
          {role && (
            <TouchableOpacity
              style={[s.chatBtn, { borderColor: club.color ?? '#a78bfa' }]}
              onPress={() => router.push(`/club-room/${id}` as any)}>
              <Ionicons name="chatbubbles-outline" size={16} color={club.color ?? '#a78bfa'} />
              <Text style={[s.chatBtnText, { color: club.color ?? '#a78bfa' }]}>Chat</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.joinBtn, role && s.leaveBtn]}
            onPress={handleJoinLeave}
            disabled={joinLoading}>
            {joinLoading
              ? <ActivityIndicator size="small" color={role ? '#a78bfa' : '#fff'} />
              : <Text style={[s.joinText, role && s.leaveText]}>
                  {role ? 'Leave' : 'Join'}
                </Text>}
          </TouchableOpacity>
        </View>

        {club.description ? (
          <Text style={s.description}>{club.description}</Text>
        ) : null}

        {/* Tab bar */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.value}
              style={[s.tab, activeTab === tab.value && s.tabActive]}
              onPress={() => setActiveTab(tab.value)}>
              <Text style={[s.tabText, activeTab === tab.value && s.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {renderTabContent()}
      </ScrollView>
    </SafeAreaView>
  )
}

function EmptyTab({ message }: { message: string }) {
  return (
    <View style={s.emptyTab}>
      <Text style={s.emptyTabText}>{message}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  retryBtn: { backgroundColor: '#a78bfa', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  heroWrap: { position: 'relative' },
  hero: { width: '100%', height: 220 },
  backBtn: {
    position: 'absolute', top: 48, left: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  clubName: { fontSize: 20, fontFamily: typography.fontBold, color: '#f0f0ff', marginBottom: 3 },
  clubMeta: { fontSize: 12, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontRegular },
  description: {
    fontSize: 13, color: 'rgba(240,240,255,0.6)', lineHeight: 20,
    paddingHorizontal: 16, marginBottom: 14, fontFamily: typography.fontRegular,
  },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, backgroundColor: 'transparent',
  },
  chatBtnText: { fontSize: 12, fontFamily: typography.fontSemiBold },
  joinBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 9,
    minWidth: 70, alignItems: 'center',
  },
  leaveBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)',
  },
  joinText: { fontSize: 13, fontFamily: typography.fontSemiBold, color: '#fff' },
  leaveText: { color: '#ef4444' },
  tabBar: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  tabText: { fontSize: 12, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontMedium },
  tabTextActive: { color: '#a78bfa', fontFamily: typography.fontSemiBold },
  announcementCard: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#1c1c2e', borderRadius: 14, padding: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  announcementHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  announcementAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2a1e40', alignItems: 'center', justifyContent: 'center',
  },
  announcementInitials: { fontSize: 10, fontFamily: typography.fontBold, color: '#c4b5fd' },
  announcementAuthor: { fontSize: 12, fontFamily: typography.fontSemiBold, color: '#f0f0ff' },
  announcementTime: { fontSize: 10, color: 'rgba(240,240,255,0.35)', fontFamily: typography.fontRegular },
  announcementBody: { fontSize: 13, color: 'rgba(240,240,255,0.7)', lineHeight: 20, fontFamily: typography.fontRegular },
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
  memberInitials: { fontSize: 11, fontFamily: typography.fontBold, color: '#c4b5fd' },
  memberName: { fontSize: 13, fontFamily: typography.fontMedium, color: '#f0f0ff', marginBottom: 1 },
  memberDept: { fontSize: 11, color: 'rgba(240,240,255,0.35)', fontFamily: typography.fontRegular },
  roleBadge: {
    backgroundColor: 'rgba(167,139,250,0.12)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  roleText: { fontSize: 9, color: '#a78bfa', fontFamily: typography.fontSemiBold },
  emptyTab: { alignItems: 'center', paddingVertical: 40 },
  emptyTabText: { fontSize: 13, color: 'rgba(240,240,255,0.3)', fontFamily: typography.fontRegular },
})
