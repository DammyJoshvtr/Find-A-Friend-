/**
 * app/course/[id].tsx
 * Course detail — Study Groups | Discussions | Resources tabs.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Alert,
} from 'react-native'
import Toast from 'react-native-toast-message'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  getCourses, getStudyGroups, getResources,
  getCourseDiscussions, createAcademicPost,
  enrollInCourse, unenrollFromCourse,
} from '../../lib/academic'
import StudyGroupCard from '../../components/academic/StudyGroupCard'
import { getInitials, getTimeAgo } from '../../lib/matching'
import type { Course, StudyGroup, AcademicResource, CourseDiscussion } from '../../lib/academic'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { supabase } from '../../lib/supabase'

type Tab = 'groups' | 'discussions' | 'resources'

const RESOURCE_TYPE_COLORS: Record<string, string> = {
  note: '#60a5fa',
  past_question: '#f472b6',
  textbook: '#34d399',
  slide: '#fbbf24',
  other: 'rgba(240,240,255,0.4)',
}

export default function CourseDetailScreen() {
  const theme = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('groups')

  const [groups, setGroups] = useState<StudyGroup[]>([])
  const [discussions, setDiscussions] = useState<CourseDiscussion[]>([])
  const [resources, setResources] = useState<AcademicResource[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (id) loadCourse()
  }, [id])

  useEffect(() => {
    if (id && course) loadTabData(activeTab)
  }, [activeTab, course])

  const loadCourse = async () => {
    setLoading(true)
    try {
      const { data } = await getCourses()
      const found = (data ?? []).find(c => c.id === id) ?? null
      setCourse(found)

      // Check enrollment
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: enrollment } = await supabase
          .from('course_enrollments')
          .select('course_id')
          .eq('user_id', user.id)
          .eq('course_id', id)
          .maybeSingle()
        setIsEnrolled(!!enrollment)
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }

  const loadTabData = async (tab: Tab) => {
    setTabLoading(true)
    switch (tab) {
      case 'groups': {
        const { data } = await getStudyGroups(id)
        setGroups(data ?? [])
        break
      }
      case 'discussions': {
        const { data } = await getCourseDiscussions(id)
        setDiscussions(data ?? [])
        break
      }
      case 'resources': {
        const { data } = await getResources({ courseId: id })
        setResources(data ?? [])
        break
      }
    }
    setTabLoading(false)
  }

  const handleEnrollToggle = async () => {
    setEnrollLoading(true)
    if (isEnrolled) {
      Alert.alert('Unenroll', `Remove ${course?.code} from your courses?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => setEnrollLoading(false) },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            const { error } = await unenrollFromCourse(id)
            if (!error) setIsEnrolled(false)
            else Toast.show({ type: 'error', text1: 'Error', text2: 'Could not unenroll.' })
            setEnrollLoading(false)
          },
        },
      ])
    } else {
      const { error } = await enrollInCourse(id)
      if (!error) setIsEnrolled(true)
      else Toast.show({ type: 'error', text1: 'Error', text2: 'Could not enroll.' })
      setEnrollLoading(false)
    }
  }

  const handlePost = async () => {
    if (!commentText.trim()) return
    setPosting(true)
    const { data, error } = await createAcademicPost(id, commentText.trim())
    setPosting(false)
    if (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not post.' })
    } else if (data) {
      setDiscussions(prev => [data, ...prev])
      setCommentText('')
    }
  }

  const onRefresh = useCallback(() => {
    loadTabData(activeTab)
  }, [activeTab])

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      </SafeAreaView>
    )
  }

  if (!course) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <Text style={s.errorText}>Course not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={s.retryBtn}>
            <Text style={s.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const renderTabContent = () => {
    if (tabLoading) {
      return <ActivityIndicator color="#a78bfa" style={{ marginTop: 30 }} />
    }

    if (activeTab === 'groups') {
      return (
        <FlatList
          data={groups}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <StudyGroupCard group={item} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={36} color="rgba(240,240,255,0.1)" />
              <Text style={s.emptyText}>No study groups for this course</Text>
            </View>
          }
          scrollEnabled={false}
        />
      )
    }

    if (activeTab === 'discussions') {
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
              <Ionicons name="chatbubbles-outline" size={36} color="rgba(240,240,255,0.1)" />
              <Text style={s.emptyText}>No discussions yet. Start one below.</Text>
            </View>
          }
          scrollEnabled={false}
        />
      )
    }

    // Resources
    return (
      <FlatList
        data={resources}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const color = RESOURCE_TYPE_COLORS[item.resource_type] ?? 'rgba(240,240,255,0.4)'
          const sizeLabel = item.file_size_kb
            ? item.file_size_kb >= 1024
              ? `${(item.file_size_kb / 1024).toFixed(1)} MB`
              : `${item.file_size_kb} KB`
            : null
          return (
            <TouchableOpacity
              style={s.resourceCard}
              onPress={() => router.push(`/resource/${item.id}` as any)}>
              <View style={[s.resourceIconWrap, { backgroundColor: color + '18' }]}>
                <Ionicons name="document-text-outline" size={18} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.resourceTitle} numberOfLines={1}>{item.title}</Text>
                <View style={s.resourceMeta}>
                  <Text style={[s.resourceType, { color }]}>
                    {item.resource_type.replace('_', ' ')}
                  </Text>
                  <Text style={s.resourceTime}>{getTimeAgo(item.created_at)}</Text>
                  {sizeLabel && <Text style={s.resourceSize}>{sizeLabel}</Text>}
                </View>
              </View>
              <View style={s.downloadBadge}>
                <Ionicons name="download-outline" size={11} color="rgba(240,240,255,0.35)" />
                <Text style={s.downloadCount}>{item.download_count}</Text>
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="document-outline" size={36} color="rgba(240,240,255,0.1)" />
            <Text style={s.emptyText}>No resources yet</Text>
          </View>
        }
        scrollEnabled={false}
      />
    )
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#f0f0ff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={s.courseCode}>{course.code}</Text>
            <Text style={s.courseName} numberOfLines={1}>{course.name}</Text>
          </View>
          <TouchableOpacity
            style={[s.enrollBtn, isEnrolled && s.enrolledBtn]}
            onPress={handleEnrollToggle}
            disabled={enrollLoading}>
            {enrollLoading
              ? <ActivityIndicator size="small" color={isEnrolled ? '#ef4444' : '#fff'} />
              : <Text style={[s.enrollText, isEnrolled && s.enrolledText]}>
                  {isEnrolled ? 'Enrolled' : 'Enroll'}
                </Text>}
          </TouchableOpacity>
        </View>

        {/* Meta row */}
        <View style={s.metaRow}>
          {course.department && (
            <View style={s.metaChip}>
              <Ionicons name="business-outline" size={10} color="rgba(240,240,255,0.35)" />
              <Text style={s.metaChipText}>{course.department}</Text>
            </View>
          )}
          {course.level && (
            <View style={s.metaChip}>
              <Ionicons name="school-outline" size={10} color="rgba(240,240,255,0.35)" />
              <Text style={s.metaChipText}>{course.level}</Text>
            </View>
          )}
          {course.semester && (
            <View style={s.metaChip}>
              <Ionicons name="calendar-outline" size={10} color="rgba(240,240,255,0.35)" />
              <Text style={s.metaChipText}>{course.semester}</Text>
            </View>
          )}
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {(['groups', 'discussions', 'resources'] as Tab[]).map(tab => (
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

        <FlatList
          data={[]}
          keyExtractor={() => 'placeholder'}
          renderItem={null}
          ListHeaderComponent={renderTabContent()}
          scrollEnabled
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
          onRefresh={onRefresh}
          refreshing={false}
        />

        {/* Discussion input */}
        {activeTab === 'discussions' && isEnrolled && (
          <View style={s.inputBar}>
            <TextInput
              style={s.inputField}
              placeholder="Ask a question or share something..."
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
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  courseCode: { fontSize: 11, color: '#a78bfa', marginBottom: 1, fontFamily: typography.fontRegular },
  courseName: { fontSize: 15, fontFamily: typography.fontBold, color: '#f0f0ff' },
  enrollBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, minWidth: 66, alignItems: 'center',
  },
  enrolledBtn: {
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.3)',
  },
  enrollText: { fontSize: 12, fontFamily: typography.fontSemiBold, color: '#fff' },
  enrolledText: { color: '#34d399' },
  metaRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1c1c2e', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  metaChipText: { fontSize: 10, color: 'rgba(240,240,255,0.35)' },
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
  tabText: { fontSize: 11, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontMedium },
  tabTextActive: { color: '#a78bfa', fontFamily: typography.fontBold },
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
  discussionInitials: { fontSize: 10, fontFamily: typography.fontBold, color: '#c4b5fd' },
  discussionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  discussionAuthor: { fontSize: 12, fontFamily: typography.fontSemiBold, color: '#f0f0ff' },
  discussionTime: { fontSize: 10, color: 'rgba(240,240,255,0.35)', fontFamily: typography.fontRegular },
  discussionBody: { fontSize: 13, color: 'rgba(240,240,255,0.7)', lineHeight: 18, fontFamily: typography.fontRegular },
  resourceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#1c1c2e', borderRadius: 14, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  resourceIconWrap: {
    width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  resourceTitle: { fontSize: 13, fontFamily: typography.fontMedium, color: '#f0f0ff', marginBottom: 4 },
  resourceMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resourceType: { fontSize: 10, fontFamily: typography.fontMedium, textTransform: 'capitalize' },
  resourceTime: { fontSize: 10, color: 'rgba(240,240,255,0.35)', fontFamily: typography.fontRegular },
  resourceSize: { fontSize: 10, color: 'rgba(240,240,255,0.25)', fontFamily: typography.fontRegular },
  downloadBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  downloadCount: { fontSize: 10, color: 'rgba(240,240,255,0.35)', fontFamily: typography.fontRegular },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.3)', textAlign: 'center', fontFamily: typography.fontRegular },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  inputField: {
    flex: 1, backgroundColor: '#1c1c2e', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, color: '#f0f0ff', maxHeight: 80,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', fontFamily: typography.fontRegular,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
})
