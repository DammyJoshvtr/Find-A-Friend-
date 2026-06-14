/**
 * app/club/[id].tsx
 * Club detail — header + tab bar: Feed | Announcements | Members | Events.
 */
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  TouchableOpacity, Image, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import * as ImagePicker from 'expo-image-picker'
import {
  getClubDetail, getMyClubRole, joinClub, leaveClub,
  getClubPosts, getClubAnnouncements, getClubMembers, getClubEvents,
  deleteClub, addClubMember, updateClubMemberRole, removeClubMember,
  createClubAnnouncement, updateClub, uploadClubCover,
} from '../../lib/clubs'
import { searchUsers } from '../../lib/search'
import PostCard from '../../components/feed/PostCard'
import EventCard from '../../components/events/EventCard'
import { getInitials, getTimeAgo } from '../../lib/matching'
import type { Club, ClubMember, ClubAnnouncement } from '../../lib/clubs'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import type { FeedPost } from '../../lib/feed'
import type { Event } from '../../lib/events'
import { supabase } from '../../lib/supabase'

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

  // Administration/Settings states
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  // Edit Club modal state
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editCoverUri, setEditCoverUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const EDIT_COLORS = [
    '#a78bfa','#8b5cf6','#7c3aed','#6d28d9','#c4b5fd',
    '#60a5fa','#3b82f6','#2563eb','#1d4ed8','#93c5fd',
    '#34d399','#10b981','#059669','#047857','#6ee7b7',
    '#f472b6','#ec4899','#db2777','#ef4444','#fca5a5',
    '#fb923c','#f97316','#fbbf24','#f59e0b','#fde68a',
    '#22d3ee','#06b6d4','#0891b2','#0e7490','#67e8f9',
  ]
  const EDIT_CATEGORIES = ['Tech','Arts','Sports','Academic','Social','Culture']

  useEffect(() => {
    if (id) loadHeader()
  }, [id])

  useEffect(() => {
    if (id) loadTabData(activeTab)
  }, [activeTab, id])

  const loadHeader = async () => {
    setLoading(true)
    try {
      const [clubRes, myRole, authUserRes] = await Promise.all([
        getClubDetail(id),
        getMyClubRole(id),
        supabase.auth.getUser(),
      ])
      if (clubRes.error) {
        throw clubRes.error
      }
      setClub(clubRes.data)
      setRole(myRole)
      if (authUserRes.data?.user) {
        setMyUserId(authUserRes.data.user.id)
      }
    } catch (err: any) {
      console.error('Error loading header:', err)
      Toast.show({
        type: 'error',
        text1: 'Could not load club details',
        text2: err?.message || String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  const loadTabData = async (tab: Tab) => {
    setTabLoading(true)
    try {
      switch (tab) {
        case 'feed': {
          const { data, error } = await getClubPosts(id)
          if (error) throw error
          setPosts(data ?? [])
          break
        }
        case 'announcements': {
          const { data, error } = await getClubAnnouncements(id)
          if (error) throw error
          setAnnouncements(data ?? [])
          break
        }
        case 'members': {
          const { data, error } = await getClubMembers(id)
          if (error) throw error
          setMembers(data ?? [])
          break
        }
        case 'events': {
          const { data, error } = await getClubEvents(id)
          if (error) throw error
          setEvents(data ?? [])
          break
        }
      }
    } catch (err: any) {
      console.error('Error loading tab:', tab, err)
      Toast.show({
        type: 'error',
        text1: `Could not load ${tab}`,
        text2: err?.message || String(err),
      })
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

  const updateClubSettings = async (field: 'settings_send_messages' | 'settings_edit_info', value: 'all' | 'admins') => {
    if (!club) return
    const { error } = await supabase
      .from('clubs')
      .update({ [field]: value })
      .eq('id', club.id)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setClub(prev => prev ? { ...prev, [field]: value } : prev)
    }
  }

  const openEditModal = () => {
    if (!club) return
    setEditName(club.name)
    setEditDesc(club.description ?? '')
    setEditCategory(club.category)
    setEditColor(club.color)
    setEditCoverUri(null)
    setShowEdit(true)
  }

  const pickEditCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission needed', text2: 'Allow photo access.' })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: false, quality: 0.8,
    })
    if (!result.canceled) setEditCoverUri(result.assets[0].uri)
  }

  const handleSaveEdit = async () => {
    if (!club || !editName.trim()) {
      Toast.show({ type: 'error', text1: 'Club name required' })
      return
    }
    setSaving(true)
    try {
      let coverUrl = club.cover_url
      if (editCoverUri) {
        const { data, error } = await uploadClubCover(editCoverUri)
        if (error) throw error
        coverUrl = data
      }
      const { error } = await updateClub(club.id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        category: editCategory,
        color: editColor,
        cover_url: coverUrl,
      })
      if (error) throw error
      // Update local state immediately
      setClub(prev => prev ? {
        ...prev,
        name: editName.trim(),
        description: editDesc.trim() || null,
        category: editCategory,
        color: editColor,
        cover_url: coverUrl ?? prev.cover_url,
      } : prev)
      setShowEdit(false)
      Toast.show({ type: 'success', text1: 'Club updated!' })
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: err?.message })
    } finally {
      setSaving(false)
    }
  }

  const handleMemberTap = (item: ClubMember) => {
    if (item.user_id === myUserId) {
      router.push('/profile' as any)
      return
    }

    if (role !== 'admin') {
      router.push(`/profile/${item.user_id}` as any)
      return
    }

    Alert.alert(
      `${item.profiles?.full_name ?? 'Member'} Options`,
      'Manage this member\'s role or membership',
      [
        {
          text: item.role === 'admin' ? 'Demote to Moderator' : 'Make Admin',
          onPress: async () => {
            const newRole = item.role === 'admin' ? 'moderator' : 'admin'
            const { error } = await updateClubMemberRole(id, item.user_id, newRole)
            if (error) Alert.alert('Error', error.message)
            else {
              Alert.alert('Success', `Updated role to ${newRole}`)
              loadTabData('members')
            }
          }
        },
        {
          text: item.role === 'moderator' ? 'Demote to Member' : 'Make Moderator',
          onPress: async () => {
            const newRole = item.role === 'moderator' ? 'member' : 'moderator'
            const { error } = await updateClubMemberRole(id, item.user_id, newRole)
            if (error) Alert.alert('Error', error.message)
            else {
              Alert.alert('Success', `Updated role to ${newRole}`)
              loadTabData('members')
            }
          }
        },
        {
          text: 'Remove from Club',
          style: 'destructive',
          onPress: async () => {
            Alert.alert(
              'Remove Member',
              `Are you sure you want to remove ${item.profiles?.full_name ?? 'this user'}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: async () => {
                    const { error } = await removeClubMember(id, item.user_id)
                    if (error) Alert.alert('Error', error.message)
                    else {
                      Alert.alert('Success', 'Member removed')
                      setClub(c => c ? { ...c, member_count: Math.max(0, c.member_count - 1) } : c)
                      loadTabData('members')
                    }
                  }
                }
              ]
            )
          }
        },
        { text: 'View Profile', onPress: () => router.push(`/profile/${item.user_id}` as any) },
        { text: 'Cancel', style: 'cancel' }
      ]
    )
  }

  const renderTabContent = () => {
    if (tabLoading) return <ActivityIndicator color="#a78bfa" style={{ marginTop: 30 }} />

    switch (activeTab) {
      case 'feed':
        return (
          <View style={{ paddingBottom: 20 }}>
            {role && (
              <TouchableOpacity
                style={[s.createPostBar, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => router.push(`/create-post?clubId=${id}` as any)}>
                <View style={[s.createPostAvatar, { backgroundColor: theme.card2 }]}>
                  <Text style={[s.createPostInitials, { color: theme.textMuted }]}>
                    {getInitials(club?.name ?? '')}
                  </Text>
                </View>
                <Text style={[s.createPostPlaceholder, { color: theme.textMuted }]}>
                  Write something to the club...
                </Text>
                <Ionicons name="image-outline" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            )}
            {posts.length === 0 ? (
              <EmptyTab message="No posts yet" />
            ) : (
              posts.map(item => <PostCard key={item.id} post={item} />)
            )}
          </View>
        )
      case 'announcements':
        return (
          <View style={{ paddingBottom: 20 }}>
            {(role === 'admin' || role === 'moderator') && (
              <AnnouncementComposer clubId={id} onPublished={() => loadTabData('announcements')} />
            )}
            {announcements.length === 0 ? (
              <EmptyTab message="No announcements" />
            ) : (
              announcements.map(item => (
                <View key={item.id} style={s.announcementCard}>
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
              ))
            )}
          </View>
        )
      case 'members':
        return (
          <View style={{ paddingBottom: 20 }}>
            {members.length === 0 ? (
              <EmptyTab message="No members yet" />
            ) : (
              members.map(item => (
                <TouchableOpacity
                  key={`${item.club_id}-${item.user_id}`}
                  style={s.memberRow}
                  onPress={() => handleMemberTap(item)}>
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
              ))
            )}
          </View>
        )
      case 'events':
        return (
          <View style={{ paddingBottom: 20 }}>
            {(role === 'admin' || role === 'moderator') && (
              <TouchableOpacity
                style={[s.createEventBtn, { backgroundColor: theme.accent }]}
                onPress={() => router.push(`/create-event?clubId=${id}` as any)}>
                <Ionicons name="calendar-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={s.createEventBtnText}>Schedule New Event</Text>
              </TouchableOpacity>
            )}
            {events.length === 0 ? (
              <EmptyTab message="No events scheduled" />
            ) : (
              events.map(item => <EventCard key={item.id} event={item} />)
            )}
          </View>
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
          {role === 'admin' && (
            <View style={{ position: 'absolute', right: 16, top: 16, flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[s.backBtn, { position: 'relative', top: 0, left: 0 }]}
                onPress={openEditModal}>
                <Ionicons name="pencil-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.backBtn, { position: 'relative', top: 0, left: 0 }]}
                onPress={() => setShowSettings(true)}>
                <Ionicons name="settings-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
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

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <View style={s.modalContainer}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowSettings(false)} />
          <View style={[s.modalSheet, { backgroundColor: theme.cardSolid || theme.card2, borderColor: theme.border }]}>
          <View style={[s.modalHandle, { backgroundColor: theme.border2 }]} />
          <Text style={[s.modalTitle, { color: theme.text }]}>Club Settings</Text>

          <TouchableOpacity
            style={[s.settingsOption, { borderBottomWidth: 0.5, borderColor: theme.border }]}
            onPress={() => { setShowSettings(false); setShowAddMember(true); }}>
            <Ionicons name="person-add-outline" size={20} color={theme.text} style={{ marginRight: 12 }} />
            <Text style={{ color: theme.text, fontSize: 15, fontFamily: typography.fontMedium }}>Add Members</Text>
          </TouchableOpacity>

          <View style={{ borderBottomWidth: 0.5, borderColor: theme.border, paddingVertical: 12 }}>
            <Text style={{ color: theme.textMuted, fontSize: 11, fontFamily: typography.fontBold, textTransform: 'uppercase', marginBottom: 8 }}>Who can send messages</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 0.5, borderColor: theme.border, backgroundColor: theme.card2 }, club.settings_send_messages !== 'admins' && { backgroundColor: theme.accent, borderColor: 'transparent' }]}
                onPress={() => updateClubSettings('settings_send_messages', 'all')}>
                <Text style={{ color: club.settings_send_messages !== 'admins' ? '#fff' : theme.text, fontSize: 12, fontFamily: typography.fontBold }}>All Members</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 0.5, borderColor: theme.border, backgroundColor: theme.card2 }, club.settings_send_messages === 'admins' && { backgroundColor: theme.accent, borderColor: 'transparent' }]}
                onPress={() => updateClubSettings('settings_send_messages', 'admins')}>
                <Text style={{ color: club.settings_send_messages === 'admins' ? '#fff' : theme.text, fontSize: 12, fontFamily: typography.fontBold }}>Only Admins</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ borderBottomWidth: 0.5, borderColor: theme.border, paddingVertical: 12 }}>
            <Text style={{ color: theme.textMuted, fontSize: 11, fontFamily: typography.fontBold, textTransform: 'uppercase', marginBottom: 8 }}>Who can edit group info</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 0.5, borderColor: theme.border, backgroundColor: theme.card2 }, club.settings_edit_info !== 'admins' && { backgroundColor: theme.accent, borderColor: 'transparent' }]}
                onPress={() => updateClubSettings('settings_edit_info', 'all')}>
                <Text style={{ color: club.settings_edit_info !== 'admins' ? '#fff' : theme.text, fontSize: 12, fontFamily: typography.fontBold }}>All Members</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 0.5, borderColor: theme.border, backgroundColor: theme.card2 }, club.settings_edit_info === 'admins' && { backgroundColor: theme.accent, borderColor: 'transparent' }]}
                onPress={() => updateClubSettings('settings_edit_info', 'admins')}>
                <Text style={{ color: club.settings_edit_info === 'admins' ? '#fff' : theme.text, fontSize: 12, fontFamily: typography.fontBold }}>Only Admins</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[s.settingsOption, { marginTop: 14 }]}
            onPress={() => {
              Alert.alert(
                'Delete Club',
                'This will permanently delete this club, its announcements, and membership records. This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete Permanently',
                    style: 'destructive',
                    onPress: async () => {
                      const { error } = await deleteClub(id)
                      if (error) Alert.alert('Error', error.message)
                      else {
                        Alert.alert('Deleted', 'The club was successfully deleted.')
                        setShowSettings(false)
                        router.replace('/clubs')
                      }
                    }
                  }
                ]
              )
            }}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" style={{ marginRight: 12 }} />
            <Text style={{ color: '#ef4444', fontSize: 15, fontFamily: typography.fontMedium }}>Delete Club</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.closeBtn, { marginTop: 24 }]} onPress={() => setShowSettings(false)}>
            <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '600' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

      {/* ── Edit Club Modal ── */}
      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <View style={s.modalContainer}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowEdit(false)} />
          <View style={[s.modalSheet, { backgroundColor: theme.cardSolid || theme.card2, borderColor: theme.border, maxHeight: '90%' }]}>
            <View style={[s.modalHandle, { backgroundColor: theme.border2 }]} />

            {/* Header row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[s.modalTitle, { color: theme.text, flex: 1, marginBottom: 0 }]}>Edit Club</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>

              {/* Cover image */}
              <TouchableOpacity
                style={[s.editCoverBox, { borderColor: editCoverUri ? editColor : 'rgba(255,255,255,0.08)' }]}
                onPress={pickEditCover}>
                {editCoverUri || club?.cover_url ? (
                  <>
                    <Image
                      source={{ uri: editCoverUri ?? club?.cover_url ?? '' }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                    <View style={s.coverDimOverlay}>
                      <Ionicons name="camera-outline" size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 11, marginTop: 3 }}>Change cover</Text>
                    </View>
                  </>
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="image-outline" size={26} color="rgba(240,240,255,0.2)" />
                    <Text style={{ color: 'rgba(240,240,255,0.3)', fontSize: 11, marginTop: 4 }}>Tap to add a cover image</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Name */}
              <Text style={[s.editLabel, { color: theme.textMuted }]}>Club name *</Text>
              <TextInput
                style={[s.editInput, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Club name"
                placeholderTextColor={theme.textFaint}
              />

              {/* Description */}
              <Text style={[s.editLabel, { color: theme.textMuted }]}>Description</Text>
              <TextInput
                style={[s.editInput, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text, height: 80 }]}
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="What is this club about?"
                placeholderTextColor={theme.textFaint}
                multiline
              />

              {/* Category */}
              <Text style={[s.editLabel, { color: theme.textMuted }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {EDIT_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.editCatPill, editCategory === cat && { backgroundColor: `${editColor}25`, borderColor: editColor }]}
                    onPress={() => setEditCategory(cat)}>
                    <Text style={[s.editCatText, editCategory === cat && { color: editColor, fontFamily: typography.fontBold }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Colour palette */}
              <Text style={[s.editLabel, { color: theme.textMuted }]}>Club colour</Text>
              <View style={s.editColorGrid}>
                {EDIT_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setEditColor(c)}
                    style={[s.editColorSwatch, { backgroundColor: c }, editColor === c && s.editColorSwatchActive]}>
                    {editColor === c && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[s.editColorPreview, { backgroundColor: `${editColor}18`, borderColor: editColor }]}>
                <View style={[{ width: 12, height: 12, borderRadius: 6, backgroundColor: editColor }]} />
                <Text style={{ color: editColor, fontSize: 11, fontFamily: typography.fontMedium, marginLeft: 6 }}>Selected: {editColor}</Text>
              </View>

            </ScrollView>

            {/* Save button */}
            <TouchableOpacity
              style={[s.editSaveBtn, { backgroundColor: editColor }, saving && { opacity: 0.6 }]}
              onPress={handleSaveEdit}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.editSaveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Member Modal */}
      <Modal visible={showAddMember} transparent animationType="slide" onRequestClose={() => setShowAddMember(false)}>
        <View style={s.modalContainer}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowAddMember(false)} />
          <View style={[s.modalSheet, { backgroundColor: theme.cardSolid || theme.card2, borderColor: theme.border, maxHeight: '85%' }]}>
          <View style={[s.modalHandle, { backgroundColor: theme.border2 }]} />
          <Text style={[s.modalTitle, { color: theme.text }]}>Add Member to Club</Text>

          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={15} color="rgba(240,240,255,0.3)" />
            <TextInput
              style={s.searchInput}
              placeholder="Search students..."
              placeholderTextColor="rgba(240,240,255,0.3)"
              value={search}
              onChangeText={async (val) => {
                setSearch(val)
                if (val.trim().length > 1) {
                  setSearching(true)
                  const { data } = await searchUsers(val)
                  setSearchResults(data ?? [])
                  setSearching(false)
                } else {
                  setSearchResults([])
                }
              }}
            />
          </View>

          {searching ? (
            <ActivityIndicator color="#a78bfa" style={{ marginVertical: 20 }} />
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={item => item.id}
              style={{ maxHeight: 220, marginBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.memberRow, { borderBottomWidth: 0.5, borderColor: theme.border }]}
                  onPress={async () => {
                    if (members.some(m => m.user_id === item.id)) {
                      Alert.alert('Info', 'User is already a member of this club')
                      return
                    }
                    const { error } = await addClubMember(id, item.id)
                    if (error) Alert.alert('Error', error.message)
                    else {
                      Alert.alert('Success', `${item.full_name ?? 'User'} added to club`)
                      setShowAddMember(false)
                      setSearch('')
                      setSearchResults([])
                      setClub(c => c ? { ...c, member_count: c.member_count + 1 } : c)
                      loadTabData('members')
                    }
                  }}>
                  <Text style={{ color: theme.text, fontSize: 14 }}>{item.full_name ?? 'Student'}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12 }}>{item.department ?? ''}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                search.trim().length > 1 ? (
                  <Text style={{ textAlign: 'center', color: theme.textFaint, marginVertical: 10 }}>No students found</Text>
                ) : null
              }
            />
          )}

          <TouchableOpacity style={s.closeBtn} onPress={() => { setShowAddMember(false); setSearch(''); setSearchResults([]); }}>
            <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </SafeAreaView>
  )
}

function AnnouncementComposer({ clubId, onPublished }: { clubId: string; onPublished: () => void }) {
  const theme = useTheme()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const handlePublish = async () => {
    if (!body.trim()) return
    setSending(true)
    const { error } = await createClubAnnouncement(clubId, body.trim())
    setSending(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setBody('')
      onPublished()
      Alert.alert('Success', 'Announcement posted!')
    }
  }

  return (
    <View style={[sc.card, { backgroundColor: theme.cardSolid || theme.card2, borderColor: theme.border }]}>
      <Text style={[sc.title, { color: theme.text }]}>Post Announcement</Text>
      <TextInput
        style={[sc.input, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text }]}
        placeholder="Write an announcement to members..."
        placeholderTextColor={theme.textFaint}
        value={body}
        onChangeText={setBody}
        multiline
      />
      <TouchableOpacity
        style={[sc.btn, { backgroundColor: theme.accent }, !body.trim() && { opacity: 0.5 }]}
        onPress={handlePublish}
        disabled={sending || !body.trim()}
      >
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={sc.btnText}>Post</Text>}
      </TouchableOpacity>
    </View>
  )
}

const sc = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, padding: 14, borderWidth: 0.5 },
  title: { fontSize: 13, fontFamily: typography.fontSemiBold, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderRadius: 10, borderWidth: 0.5, padding: 12, fontSize: 13, height: 70, textAlignVertical: 'top', marginBottom: 10, fontFamily: typography.fontRegular },
  btn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 12, fontFamily: typography.fontBold, color: '#fff' },
})

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
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40,
    borderWidth: 0.5, borderBottomWidth: 0, maxHeight: '85%',
    width: '100%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: typography.fontBold, marginBottom: 18, textAlign: 'center' },
  settingsOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14,
  },
  closeBtn: {
    borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 14,
    backgroundColor: '#1c1c2e',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#f0f0ff', fontFamily: typography.fontRegular },
  editCoverBox: {
    height: 110, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#1c1c2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  coverDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  editLabel: {
    fontSize: 12, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontBold,
    textTransform: 'uppercase', marginBottom: 8, marginTop: 12,
  },
  editInput: {
    borderRadius: 12, borderWidth: 0.5, padding: 12, fontSize: 14,
    marginBottom: 16, fontFamily: typography.fontRegular,
  },
  editCatPill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  editCatText: { fontSize: 12, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontMedium },
  editColorGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 12,
  },
  editColorSwatch: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  editColorSwatchActive: {
    borderWidth: 3, borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },
  editColorPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, marginBottom: 16,
  },
  editSaveBtn: {
    borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 10,
  },
  editSaveBtnText: { fontSize: 15, fontFamily: typography.fontBold, color: '#fff' },
  createPostBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    borderRadius: 14, borderWidth: 0.5,
  },
  createPostAvatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  createPostInitials: {
    fontSize: 12, fontFamily: typography.fontBold,
  },
  createPostPlaceholder: {
    flex: 1, fontSize: 13, fontFamily: typography.fontRegular,
  },
  createEventBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 14, marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    borderRadius: 14, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  createEventBtnText: {
    color: '#fff', fontSize: 14, fontFamily: typography.fontBold,
  },
})
