import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { getResources, getMyEnrolledCourses, uploadResource } from '../lib/academic'
import type { AcademicResource, Course } from '../lib/academic'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import Toast from 'react-native-toast-message'

export default function UploadResourceScreen() {
  const theme = useTheme()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState<string>('')
  const [resourceType, setResourceType] = useState<'note' | 'past_question' | 'textbook' | 'slide' | 'other'>('note')
  const [file, setFile] = useState<{ uri: string; name: string; type: string } | null>(null)
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    getMyEnrolledCourses().then(({ data }) => {
      if (data) setCourses(data)
    })
  }, [])

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      })
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selected = result.assets[0]
        setFile({
          uri: selected.uri,
          name: selected.name,
          type: selected.mimeType || 'application/octet-stream',
          size: selected.size,
        } as any)
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error picking file', text2: err.message })
    }
  }

  const handleUpload = async () => {
    if (!title.trim()) {
      Toast.show({ type: 'error', text1: 'Title required' })
      return
    }
    if (!file) {
      Toast.show({ type: 'error', text1: 'Please select a file' })
      return
    }
    setLoading(true)
    try {
      const fileSizeKb = (file as any).size ? Math.round((file as any).size / 1024) : undefined
      const { data, error } = await uploadResource({
        title: title.trim(),
        description: description.trim() || undefined,
        courseId: courseId || undefined,
        resourceType,
        fileUri: file.uri,
        fileName: file.name,
        mimeType: file.type,
        fileSizeKb,
      })
      if (error) throw error

      Toast.show({ type: 'success', text1: 'Resource uploaded successfully' })
      router.back()
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Upload Resource</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.field}>
            <Text style={[s.label, { color: theme.text }]}>Title *</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Resource title"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: theme.text }]}>Description</Text>
            <TextInput
              style={[s.input, s.inputMulti, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              placeholderTextColor={theme.textMuted}
              multiline
            />
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: theme.text }]}>Course (optional)</Text>
            <View style={s.courseList}>
              <TouchableOpacity
                style={[s.courseChip, !courseId && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                onPress={() => setCourseId('')}
              >
                <Text style={[s.courseChipText, !courseId && { color: '#fff' }]}>None</Text>
              </TouchableOpacity>
              {courses.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.courseChip, courseId === c.id && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => setCourseId(c.id)}
                >
                  <Text style={[s.courseChipText, courseId === c.id && { color: '#fff' }]}>{c.code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: theme.text }]}>Resource Type *</Text>
            <View style={s.courseList}>
              {[
                { label: 'Note', value: 'note' },
                { label: 'Past Question', value: 'past_question' },
                { label: 'Textbook', value: 'textbook' },
                { label: 'Slide', value: 'slide' },
                { label: 'Other', value: 'other' }
              ].map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={[s.courseChip, resourceType === type.value && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => setResourceType(type.value as any)}
                >
                  <Text style={[s.courseChipText, resourceType === type.value && { color: '#fff' }]}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: theme.text }]}>File *</Text>
            <TouchableOpacity style={s.fileBtn} onPress={pickFile} disabled={loading}>
              <Ionicons name={file ? 'checkmark-circle' : 'document'} size={20} color={theme.text} />
              <Text style={[s.fileBtnText, { color: theme.text }]}>{file ? file.name : 'Select file'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.accent }]} onPress={handleUpload} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Upload</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: typography.fontBold },
  content: { padding: 16, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontFamily: typography.fontSemiBold },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: typography.fontRegular },
  inputMulti: { minHeight: 80 },
  courseList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  courseChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  courseChipText: { fontSize: 13, fontFamily: typography.fontMedium, color: 'rgba(255,255,255,0.6)' },
  fileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderRadius: 12 },
  fileBtnText: { fontSize: 15, fontFamily: typography.fontRegular },
  submitBtn: { marginTop: 20, borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontFamily: typography.fontBold },
})
