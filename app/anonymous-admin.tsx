/**
 * app/anonymous-admin.tsx
 * Admin Dashboard for Anonymous Confession Board
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, FlatList, RefreshControl
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { client } from '../../lib/aws'
import { getCurrentUser } from 'aws-amplify/auth'
import { getCurrentProfile } from '../lib/profiles'
import { getAnonymousPosts } from '../lib/anonymous'
import type { AnonymousPost } from '../lib/anonymous'
import { createEvent } from '../lib/events'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'

function parseDateTime(raw: string): Date | null {
  if (!raw.trim()) return null
  const normalised = raw.trim().replace(' ', 'T')
  const d = new Date(normalised)
  return isNaN(d.getTime()) ? null : d
}

function toInputString(d: Date | null): string {
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AnonymousAdminDashboard() {
  const theme = useTheme()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'status' | 'posts' | 'event'>('status')
  
  // Status tab state
  const [boardStatus, setBoardStatus] = useState<'open' | 'closed'>('open')
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [stats, setStats] = useState({ totalPosts: 0, totalEvents: 0 })

  // Posts tab state
  const [posts, setPosts] = useState<AnonymousPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  
  // Event tab state
  const [eventTitle, setEventTitle] = useState('')
  const [eventDesc, setEventDesc] = useState('')
  const [eventVenue, setEventVenue] = useState('')
  const defaultStart = new Date(Date.now() + 3600000)
  const [startsAtText, setStartsAtText] = useState(toInputString(defaultStart))
  const [endsAtText, setEndsAtText] = useState('')
  const [submittingEvent, setSubmittingEvent] = useState(false)

  // Verify Admin Access on Mount
  useEffect(() => {
    getCurrentProfile().then(p => {
      if (p?.role === 'admin') {
        setIsAdmin(true)
        loadBoardStatus()
        loadStats()
      } else {
        setIsAdmin(false)
        Alert.alert('Access Denied', 'Only administrators can access this page.')
        router.back()
      }
    })
  }, [])

  // Load status from system_settings
  const loadBoardStatus = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'anonymous_board_status')
        .maybeSingle()
      if (data?.value) {
        setBoardStatus(data.value as 'open' | 'closed')
      }
    } catch (err) {
      console.warn('Error loading status:', err)
    }
  }

  // Load Stats
  const loadStats = async () => {
    try {
      const { count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('is_anonymous', true)

      const { count: eventsCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('is_anonymous_linked', true)

      setStats({
        totalPosts: postsCount ?? 0,
        totalEvents: eventsCount ?? 0
      })
    } catch (e) {
      // Ignore stats errors
    }
  }

  // Fetch Anonymous Posts
  const fetchPosts = async (isRef = false) => {
    if (isRef) setRefreshing(true)
    else setLoadingPosts(true)

    try {
      const { data } = await getAnonymousPosts(undefined, 50)
      setPosts(data ?? [])
    } catch (err) {
      console.warn('Error fetching posts:', err)
    } finally {
      setLoadingPosts(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAdmin && activeTab === 'posts') {
      fetchPosts()
    }
  }, [isAdmin, activeTab])

  // Toggle Board Status
  const handleToggleStatus = async () => {
    setTogglingStatus(true)
    const nextStatus = boardStatus === 'open' ? 'closed' : 'open'
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          { key: 'anonymous_board_status', value: nextStatus, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      if (error) throw error
      setBoardStatus(nextStatus)
      Alert.alert('Success', `Confession board status set to: ${nextStatus.toUpperCase()}`)
    } catch (err) {
      Alert.alert('Error', 'Failed to update board status. Ensure SQL migrations are run.')
    } finally {
      setTogglingStatus(false)
    }
  }

  // Delete Post
  const handleDeletePost = async (postId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to permanently delete this confession? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('posts')
                .delete()
                .eq('id', postId)
              if (error) throw error
              setPosts(prev => prev.filter(p => p.id !== postId))
              setStats(s => ({ ...s, totalPosts: Math.max(0, s.totalPosts - 1) }))
              Alert.alert('Success', 'Confession deleted successfully.')
            } catch (err) {
              Alert.alert('Error', 'Failed to delete confession. Ensure you have admin RLS permissions.')
            }
          }
        }
      ]
    )
  }

  // Create Linked Event
  const handleCreateEvent = async () => {
    if (!eventTitle.trim()) {
      Alert.alert('Title required', 'Please enter an event title.')
      return
    }
    const startsAtDate = parseDateTime(startsAtText)
    const endsAtDate = parseDateTime(endsAtText)
    if (!startsAtDate) {
      Alert.alert('Invalid start date', 'Enter date as YYYY-MM-DD HH:MM, e.g. 2026-07-20 14:30')
      return
    }
    if (endsAtText.trim() && !endsAtDate) {
      Alert.alert('Invalid end date', 'Enter date as YYYY-MM-DD HH:MM, e.g. 2026-07-20 16:00')
      return
    }

    setSubmittingEvent(true)
    try {
      const { data, error } = await createEvent({
        title: eventTitle.trim(),
        description: eventDesc.trim() || undefined,
        venue: eventVenue.trim() || undefined,
        startsAt: startsAtDate.toISOString(),
        endsAt: endsAtDate ? endsAtDate.toISOString() : undefined,
        category: 'Anonymous',
        isAnonymousLinked: true,
        isPublic: true,
      })

      if (error) throw error
      Alert.alert('Success', 'Linked event created successfully!')
      setEventTitle('')
      setEventDesc('')
      setEventVenue('')
      setEndsAtText('')
      setStats(s => ({ ...s, totalEvents: s.totalEvents + 1 }))
      setActiveTab('status')
    } catch (err) {
      Alert.alert('Error', 'Failed to create event. Ensure SQL migrations are run.')
    } finally {
      setSubmittingEvent(false)
    }
  }

  if (isAdmin === null) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    )
  }

  if (isAdmin === false) {
    return null
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: theme.card }]}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View>
          <Text style={[s.title, { color: theme.text }]}>Admin Dashboard</Text>
          <Text style={[s.subtitle, { color: '#a78bfa' }]}>Anonymous Board Settings</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Tabs */}
      <View style={[s.tabBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('status')}
          style={[s.tabItem, activeTab === 'status' && [s.tabActive, { borderBottomColor: '#a78bfa' }]]}>
          <Text style={[s.tabText, activeTab === 'status' ? { color: '#a78bfa' } : { color: theme.textMuted }]}>
            Board Status
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('posts')}
          style={[s.tabItem, activeTab === 'posts' && [s.tabActive, { borderBottomColor: '#a78bfa' }]]}>
          <Text style={[s.tabText, activeTab === 'posts' ? { color: '#a78bfa' } : { color: theme.textMuted }]}>
            Confessions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('event')}
          style={[s.tabItem, activeTab === 'event' && [s.tabActive, { borderBottomColor: '#a78bfa' }]]}>
          <Text style={[s.tabText, activeTab === 'event' ? { color: '#a78bfa' } : { color: theme.textMuted }]}>
            Linked Event
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        {activeTab === 'status' && (
          <ScrollView contentContainerStyle={s.scrollContent}>
            {/* Status Card */}
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={s.cardHeader}>
                <Ionicons name="options-outline" size={20} color="#a78bfa" />
                <Text style={[s.cardTitle, { color: theme.text }]}>Board Visibility Control</Text>
              </View>
              
              <View style={s.statusRow}>
                <Text style={[s.statusLabel, { color: theme.textMuted }]}>Current Status:</Text>
                <View style={[s.statusPill, boardStatus === 'open' ? s.pillOpen : s.pillClosed]}>
                  <Text style={s.pillText}>
                    {boardStatus.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={[s.cardDesc, { color: theme.textFaint }]}>
                Closing the board hides the confession list and disables posting for all student accounts. Administrators can still view it in Admin Preview mode.
              </Text>

              <TouchableOpacity
                onPress={handleToggleStatus}
                disabled={togglingStatus}
                style={[
                  s.actionBtn, 
                  boardStatus === 'open' ? { backgroundColor: '#db2777' } : { backgroundColor: '#059669' }
                ]}>
                {togglingStatus ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.actionBtnText}>
                    {boardStatus === 'open' ? 'CLOSE CONFESSION BOARD' : 'OPEN CONFESSION BOARD'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Stats Card */}
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={s.cardHeader}>
                <Ionicons name="bar-chart-outline" size={20} color="#a78bfa" />
                <Text style={[s.cardTitle, { color: theme.text }]}>Confessions Statistics</Text>
              </View>

              <View style={s.statsGrid}>
                <View style={s.statBox}>
                  <Text style={[s.statNum, { color: theme.text }]}>{stats.totalPosts}</Text>
                  <Text style={[s.statLabel, { color: theme.textMuted }]}>Total Confessions</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={[s.statNum, { color: theme.text }]}>{stats.totalEvents}</Text>
                  <Text style={[s.statLabel, { color: theme.textMuted }]}>Linked Events</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}

        {activeTab === 'posts' && (
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchPosts(true)} tintColor="#a78bfa" />
            }
            renderItem={({ item }) => (
              <View style={[s.postItemCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={s.postItemHeader}>
                  <Text style={[s.postItemTime, { color: theme.textFaint }]}>
                    {new Date(item.created_at).toLocaleString()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDeletePost(item.id)}
                    style={s.deleteBtn}>
                    <Ionicons name="trash" size={18} color="#f43f5e" />
                  </TouchableOpacity>
                </View>
                <Text style={[s.postItemBody, { color: theme.text }]}>{item.body}</Text>
                {item.tags && item.tags.length > 0 && (
                  <View style={s.tagsRow}>
                    {item.tags.map(tag => (
                      <View key={tag} style={s.tagBadge}>
                        <Text style={s.tagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
            ListHeaderComponent={
              <View style={s.listHeader}>
                <Text style={[s.listHeaderTitle, { color: theme.text }]}>Anonymous Submissions ({posts.length})</Text>
                <TouchableOpacity onPress={() => fetchPosts(true)} style={[s.refreshBtn, { backgroundColor: theme.border }]}>
                  <Ionicons name="refresh" size={14} color={theme.text} />
                  <Text style={[s.refreshText, { color: theme.text }]}>Refresh</Text>
                </TouchableOpacity>
              </View>
            }
            ListEmptyComponent={
              loadingPosts ? (
                <View style={s.centerPadding}>
                  <ActivityIndicator size="small" color="#a78bfa" />
                </View>
              ) : (
                <View style={s.centerPadding}>
                  <Text style={{ color: theme.textMuted }}>No confessions found.</Text>
                </View>
              )
            }
            contentContainerStyle={s.listContent}
          />
        )}

        {activeTab === 'event' && (
          <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={s.cardHeader}>
                <Ionicons name="calendar-outline" size={20} color="#a78bfa" />
                <Text style={[s.cardTitle, { color: theme.text }]}>Create Confession Event</Text>
              </View>

              <Text style={[s.cardDesc, { color: theme.textMuted, marginBottom: 16 }]}>
                Create an event that will be featured prominently at the top of the Anonymous Confession Board.
              </Text>

              {/* Title */}
              <View style={s.inputGroup}>
                <Text style={[s.inputLabel, { color: theme.textMuted }]}>Event Title *</Text>
                <TextInput
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  placeholder="e.g. Confession Sharing Hour"
                  placeholderTextColor={theme.textFaint}
                  style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                />
              </View>

              {/* Venue */}
              <View style={s.inputGroup}>
                <Text style={[s.inputLabel, { color: theme.textMuted }]}>Venue / Location</Text>
                <TextInput
                  value={eventVenue}
                  onChangeText={setEventVenue}
                  placeholder="e.g. Red Common Hall, or Zoom"
                  placeholderTextColor={theme.textFaint}
                  style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                />
              </View>

              {/* Starts At */}
              <View style={s.inputGroup}>
                <Text style={[s.inputLabel, { color: theme.textMuted }]}>Start Date & Time (YYYY-MM-DD HH:MM) *</Text>
                <TextInput
                  value={startsAtText}
                  onChangeText={setStartsAtText}
                  placeholder="e.g. 2026-07-20 14:30"
                  placeholderTextColor={theme.textFaint}
                  style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                />
              </View>

              {/* Ends At */}
              <View style={s.inputGroup}>
                <Text style={[s.inputLabel, { color: theme.textMuted }]}>End Date & Time (YYYY-MM-DD HH:MM)</Text>
                <TextInput
                  value={endsAtText}
                  onChangeText={setEndsAtText}
                  placeholder="e.g. 2026-07-20 16:00"
                  placeholderTextColor={theme.textFaint}
                  style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                />
              </View>

              {/* Description */}
              <View style={s.inputGroup}>
                <Text style={[s.inputLabel, { color: theme.textMuted }]}>Description</Text>
                <TextInput
                  value={eventDesc}
                  onChangeText={setEventDesc}
                  placeholder="Details about the anonymous event..."
                  placeholderTextColor={theme.textFaint}
                  multiline
                  numberOfLines={4}
                  style={[
                    s.input, 
                    s.multilineInput, 
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }
                  ]}
                />
              </View>

              <TouchableOpacity
                onPress={handleCreateEvent}
                disabled={submittingEvent}
                style={[s.actionBtn, { backgroundColor: '#a78bfa', marginTop: 12 }]}>
                {submittingEvent ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[s.actionBtnText, { color: '#000', fontWeight: 'bold' }]}>
                    CREATE LINKED EVENT
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerPadding: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: typography.fontBold, textAlign: 'center' },
  subtitle: { fontSize: 11, textAlign: 'center', fontFamily: typography.fontRegular },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#a78bfa',
  },
  tabText: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: typography.fontBold,
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: typography.fontRegular,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillOpen: {
    backgroundColor: 'rgba(5,150,105,0.15)',
  },
  pillClosed: {
    backgroundColor: 'rgba(219,39,119,0.15)',
  },
  pillText: {
    fontSize: 11,
    fontFamily: typography.fontBold,
    color: '#fff',
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: typography.fontBold,
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  statNum: {
    fontSize: 28,
    fontFamily: typography.fontBold,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: typography.fontRegular,
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontFamily: typography.fontBold,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  refreshText: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
  },
  postItemCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  postItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postItemTime: {
    fontSize: 11,
    fontFamily: typography.fontRegular,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,63,94,0.1)',
  },
  postItemBody: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tagBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    color: '#a78bfa',
    fontFamily: typography.fontRegular,
  },
  inputGroup: {
    gap: 6,
    width: '100%',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: typography.fontRegular,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
})
