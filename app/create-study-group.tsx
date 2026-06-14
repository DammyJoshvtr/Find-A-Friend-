import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView, Switch, KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { createStudyGroup, getMyEnrolledCourses } from '../lib/academic'
import type { Course } from '../lib/academic'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import Toast from 'react-native-toast-message'

export default function CreateStudyGroupScreen() {
  const theme = useTheme()
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState<string>('')
  const [venue, setVenue] = useState('')
  const [meetTime, setMeetTime] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [maxMembers, setMaxMembers] = useState('')

  useEffect(() => {
    getMyEnrolledCourses().then(({ data }) => {
      if (data) setCourses(data)
    })
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Name required' })
      return
    }
    setLoading(true)
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      courseId: courseId || undefined,
      venue: venue.trim() || undefined,
      meetTime: meetTime.trim() || undefined,
      isRecurring,
      maxMembers: maxMembers ? parseInt(maxMembers) : undefined
    }
    const { data, error } = await createStudyGroup(payload)
    setLoading(false)

    if (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message })
    } else if (data) {
      Toast.show({ type: 'success', text1: 'Group Created!' })
      router.back()
    }
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>New Study Group</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          
          <View style={s.field}>
            <Text style={[s.label, { color: theme.text }]}>Group Name *</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              placeholder="e.g. MTH101 Weekend Study"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: theme.text }]}>Description</Text>
            <TextInput
              style={[s.input, s.inputMulti, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              placeholder="What will you study?"
              placeholderTextColor={theme.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: theme.text }]}>Related Course (Optional)</Text>
            <View style={s.courseList}>
              <TouchableOpacity
                style={[s.courseChip, !courseId && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                onPress={() => setCourseId('')}>
                <Text style={[s.courseChipText, !courseId && { color: '#fff' }]}>None</Text>
              </TouchableOpacity>
              {courses.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.courseChip, courseId === c.id && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => setCourseId(c.id)}>
                  <Text style={[s.courseChipText, courseId === c.id && { color: '#fff' }]}>{c.code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: theme.text }]}>Venue</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              placeholder="e.g. Library 3rd Floor or Google Meet"
              placeholderTextColor={theme.textMuted}
              value={venue}
              onChangeText={setVenue}
            />
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: theme.text }]}>Meet Time</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              placeholder="e.g. Saturdays 4PM"
              placeholderTextColor={theme.textMuted}
              value={meetTime}
              onChangeText={setMeetTime}
            />
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: theme.text }]}>Max Members</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              placeholder="Unlimited"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={maxMembers}
              onChangeText={setMaxMembers}
            />
          </View>

          <View style={s.switchRow}>
            <Text style={[s.label, { color: theme.text, marginBottom: 0 }]}>Is this a recurring meeting?</Text>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: theme.border, true: theme.accent }}
            />
          </View>

          <TouchableOpacity 
            style={[s.submitBtn, { backgroundColor: theme.accent }]}
            onPress={handleCreate}
            disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Create Group</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: typography.fontBold },
  content: { padding: 16, gap: 20 },
  field: { gap: 8 },
  row: { flexDirection: 'row', gap: 16 },
  label: { fontSize: 14, fontFamily: typography.fontSemiBold },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: typography.fontRegular,
  },
  inputMulti: { minHeight: 80 },
  courseList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  courseChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  courseChipText: { fontSize: 13, fontFamily: typography.fontMedium, color: 'rgba(255,255,255,0.6)' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submitBtn: {
    marginTop: 20, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontFamily: typography.fontBold },
})
