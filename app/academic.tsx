/**
 * app/academic.tsx
 * Academic hub — tab bar: My Courses | Study Groups | Resources
 */
import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native'
import Toast from 'react-native-toast-message'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import {
  getMyEnrolledCourses, getStudyGroups, getResources,
  enrollInCourse, unenrollFromCourse, getCourses,
  getMyJoinedStudyGroups,
} from '../lib/academic'
import StudyGroupCard from '../components/academic/StudyGroupCard'
import type { Course, StudyGroup, AcademicResource } from '../lib/academic'
import { getTimeAgo } from '../lib/matching'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import { useBadgesStore } from '../store/badgesStore'

type Tab = 'courses' | 'groups' | 'resources'

const RESOURCE_TYPE_ICONS: Record<string, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  note: 'document-text-outline',
  past_question: 'help-circle-outline',
  textbook: 'book-outline',
  slide: 'easel-outline',
  other: 'attach-outline',
}

const RESOURCE_TYPE_COLORS: Record<string, string> = {
  note: '#60a5fa',
  past_question: '#f472b6',
  textbook: '#34d399',
  slide: '#fbbf24',
  other: 'rgba(240,240,255,0.4)',
}

// ---------------------------------------------------------------------------
// Sub-component: Course row
// ---------------------------------------------------------------------------

interface CourseRowProps {
  course: Course
  onUnenroll: (id: string) => void
}

function CourseRow({ course, onUnenroll }: CourseRowProps) {
  const [loading, setLoading] = useState(false)
  const theme = useTheme()

  const handleUnenroll = () => {
    Alert.alert(
      'Unenroll',
      `Remove ${course.code} from your courses?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setLoading(true)
            const { error } = await unenrollFromCourse(course.id)
            setLoading(false)
            if (error) {
              Toast.show({ type: 'error', text1: 'Error', text2: 'Could not unenroll. Please try again.' })
            } else {
              onUnenroll(course.id)
            }
          },
        },
      ]
    )
  }

  return (
    <TouchableOpacity
      style={[s.courseCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => router.push(`/course/${course.id}` as any)}
      activeOpacity={0.85}>
      <View style={[s.courseAccent, { backgroundColor: theme.accent }]} />
      <View style={s.courseBody}>
        <View style={{ flex: 1 }}>
          <Text style={[s.courseCode, { color: theme.accent }]}>{course.code}</Text>
          <Text style={[s.courseName, { color: theme.text }]} numberOfLines={1}>{course.name}</Text>
          {(course.department || course.level) && (
            <Text style={[s.courseMeta, { color: theme.textMuted }]}>
              {[course.department, course.level].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        <View style={s.courseActions}>
          <TouchableOpacity
            style={[s.studyGroupBtn, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}
            onPress={() => router.push(`/course/${course.id}` as any)}>
            <Ionicons name="people-outline" size={12} color={theme.accent} />
            <Text style={[s.studyGroupBtnText, { color: theme.accent }]}>Groups</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.unenrollBtn}
            onPress={handleUnenroll}
            disabled={loading}
            hitSlop={12}>
            {loading
              ? <ActivityIndicator size="small" color={theme.danger} />
              : <Ionicons name="close-outline" size={16} color={theme.danger} />}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: Resource row
// ---------------------------------------------------------------------------

function ResourceRow({ resource }: { resource: AcademicResource }) {
  const theme = useTheme()
  const icon = RESOURCE_TYPE_ICONS[resource.resource_type] ?? 'attach-outline'
  const color = resource.resource_type === 'other'
    ? theme.textMuted
    : (RESOURCE_TYPE_COLORS[resource.resource_type] ?? theme.textMuted)
  const sizeLabel = resource.file_size_kb
    ? resource.file_size_kb >= 1024
      ? `${(resource.file_size_kb / 1024).toFixed(1)} MB`
      : `${resource.file_size_kb} KB`
    : null

  return (
    <TouchableOpacity
      style={[s.resourceCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => router.push(`/resource/${resource.id}` as any)}
      activeOpacity={0.85}>
      <View style={[s.resourceIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.resourceTitle, { color: theme.text }]} numberOfLines={1}>{resource.title}</Text>
        <View style={s.resourceMeta}>
          {resource.courses && (
            <Text style={[s.resourceCourse, { color: theme.accent, backgroundColor: theme.accentBg }]}>{resource.courses.code}</Text>
          )}
          <Text style={[s.resourceTime, { color: theme.textMuted }]}>{getTimeAgo(resource.created_at)}</Text>
          {sizeLabel && <Text style={[s.resourceSize, { color: theme.textFaint }]}>{sizeLabel}</Text>}
        </View>
      </View>
      <View style={s.downloadBadge}>
        <Ionicons name="download-outline" size={11} color={theme.textMuted} />
        <Text style={[s.downloadCount, { color: theme.textMuted }]}>{resource.download_count}</Text>
      </View>
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AcademicScreen() {
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState<Tab>('courses')
  const markSeen = useBadgesStore(s => s.markSeen)

  useFocusEffect(
    useCallback(() => {
      markSeen('academic')
    }, [markSeen])
  )

  const [courses, setCourses] = useState<Course[]>([])
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([])
  const [resources, setResources] = useState<AcademicResource[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [resourceSearch, setResourceSearch] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadTab(activeTab)
  }, [activeTab])

  const loadTab = async (tab: Tab, refresh = false) => {
    if (!refresh) setLoading(true)
    try {
      switch (tab) {
        case 'courses': {
          const { data } = await getMyEnrolledCourses()
          setCourses(data ?? [])
          break
        }
        case 'groups': {
          const [groupsRes, joinedRes] = await Promise.all([
            getStudyGroups(),
            getMyJoinedStudyGroups()
          ])
          const joinedIds = new Set(joinedRes.data ?? [])
          const mapped = (groupsRes.data ?? []).map(g => ({
            ...g,
            is_member: joinedIds.has(g.id)
          }))
          setStudyGroups(mapped)
          break
        }
        case 'resources': {
          const { data } = await getResources()
          setResources(data ?? [])
          break
        }
      }
    } catch {
      // Non-fatal — keep existing data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadTab(activeTab, true)
  }, [activeTab])

  const handleResourceSearch = (text: string) => {
    setResourceSearch(text)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await getResources({ search: text || undefined })
      setResources(data ?? [])
      setLoading(false)
    }, 300)
  }

  const handleCourseUnenrolled = (courseId: string) => {
    setCourses(prev => prev.filter(c => c.id !== courseId))
  }

  const renderContent = () => {
    if (loading) {
      return (
        <View style={s.centeredWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )
    }

    if (activeTab === 'courses') {
      return (
        <FlatList
          data={courses}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CourseRow course={item} onUnenroll={handleCourseUnenrolled} />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="book-outline" size={40} color={theme.textFaint} />
              <Text style={[s.emptyTitle, { color: theme.textMuted }]}>No enrolled courses</Text>
              <Text style={[s.emptySub, { color: theme.textFaint }]}>Browse and enroll in courses below</Text>
              <TouchableOpacity
                style={[s.browseBtn, { backgroundColor: theme.accent }]}
                onPress={() => router.push('/course-browser' as any)}>
                <Text style={s.browseBtnText}>Browse Courses</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
          scrollEnabled={false}
        />
      )
    }

    if (activeTab === 'groups') {
      return (
        <FlatList
          data={studyGroups}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <StudyGroupCard group={item} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={40} color={theme.textFaint} />
              <Text style={[s.emptyTitle, { color: theme.textMuted }]}>No study groups yet</Text>
              <Text style={[s.emptySub, { color: theme.textFaint }]}>Create one and invite your coursemates</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
          scrollEnabled={false}
        />
      )
    }

    // Resources tab
    return (
      <>
        <View style={[s.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={15} color={theme.textFaint} />
          <TextInput
            style={[s.searchInput, { color: theme.text }]}
            placeholder="Search notes, past questions..."
            placeholderTextColor={theme.textFaint}
            value={resourceSearch}
            onChangeText={handleResourceSearch}
          />
          {resourceSearch.length > 0 && (
            <TouchableOpacity onPress={() => { setResourceSearch(''); loadTab('resources') }}>
              <Ionicons name="close-circle" size={15} color={theme.textFaint} />
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={resources}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <ResourceRow resource={item} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="document-outline" size={40} color={theme.textFaint} />
              <Text style={[s.emptyTitle, { color: theme.textMuted }]}>No resources found</Text>
              <Text style={[s.emptySub, { color: theme.textFaint }]}>Upload notes or past questions to share</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
          scrollEnabled={false}
        />
      </>
    )
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border2 }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Academic Hub</Text>
        <TouchableOpacity
          style={[s.createBtn, { backgroundColor: theme.card }]}
          onPress={() => {
            if (activeTab === 'groups') router.push('/create-study-group' as any)
            else if (activeTab === 'resources') router.push('/upload-resource' as any)
            else router.push('/course-browser' as any)
          }}>
          <Ionicons name="add" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { borderBottomColor: theme.border2 }]}>
        {(['courses', 'groups', 'resources'] as Tab[]).map(tab => (
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
              { color: theme.textMuted },
              activeTab === tab && { color: theme.accent, fontFamily: typography.fontBold }
            ]}>
              {tab === 'courses' ? 'My Courses' : tab === 'groups' ? 'Study Groups' : 'Resources'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content — ScrollView wraps FlatList (scrollEnabled=false) for pull-to-refresh on non-list content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }>
        {renderContent()}
      </ScrollView>

      {/* FAB */}
      {(activeTab === 'groups' || activeTab === 'resources') && (
        <TouchableOpacity
          style={[s.fab, { backgroundColor: theme.accent }]}
          onPress={() => {
            if (activeTab === 'groups') {
              router.push('/create-study-group' as any)
            } else {
              router.push('/upload-resource' as any)
            }
          }}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: typography.fontBold, color: '#f0f0ff' },
  createBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    gap: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1c1c2e', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  tabText: { fontSize: 11, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontMedium },
  tabTextActive: { color: '#a78bfa', fontFamily: typography.fontBold },
  centeredWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  // Course card
  courseCard: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#1c1c2e', borderRadius: 14, overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  courseAccent: { width: 4, backgroundColor: '#a78bfa' },
  courseBody: {
    flex: 1, padding: 12, flexDirection: 'row',
    alignItems: 'center', gap: 10,
  },
  courseCode: { fontSize: 10, color: '#a78bfa', marginBottom: 2 },
  courseName: { fontSize: 13, fontFamily: typography.fontSemiBold, color: '#f0f0ff', marginBottom: 3 },
  courseMeta: { fontSize: 10, color: 'rgba(240,240,255,0.35)' },
  courseActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  studyGroupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  studyGroupBtnText: { fontSize: 10, color: '#a78bfa', fontFamily: typography.fontMedium },
  unenrollBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(239,68,68,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  // Resource card
  resourceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#1c1c2e', borderRadius: 14, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  resourceIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  resourceTitle: { fontSize: 13, fontFamily: typography.fontMedium, color: '#f0f0ff', marginBottom: 4 },
  resourceMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resourceCourse: {
    fontSize: 9, color: '#a78bfa', fontFamily: typography.fontSemiBold,
    backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  resourceTime: { fontSize: 10, color: 'rgba(240,240,255,0.35)' },
  resourceSize: { fontSize: 10, color: 'rgba(240,240,255,0.25)' },
  downloadBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  downloadCount: { fontSize: 10, color: 'rgba(240,240,255,0.35)' },
  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#1c1c2e', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#f0f0ff' },
  // Empty state
  empty: {
    alignItems: 'center', paddingTop: 60, paddingBottom: 40, gap: 8,
  },
  emptyTitle: { fontSize: 15, fontFamily: typography.fontSemiBold, color: 'rgba(240,240,255,0.4)' },
  emptySub: { fontSize: 12, color: 'rgba(240,240,255,0.25)', textAlign: 'center', paddingHorizontal: 32, fontFamily: typography.fontRegular },
  browseBtn: {
    marginTop: 8, backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 9,
  },
  browseBtnText: { fontSize: 13, fontFamily: typography.fontSemiBold, color: '#fff' },
  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
})
