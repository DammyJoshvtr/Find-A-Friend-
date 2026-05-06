/**
 * app/create-event.tsx
 * Create event form.
 */
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Image, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { createEvent, uploadEventCover } from '../lib/events'

const CATEGORIES = ['Technology', 'Sports', 'Culture', 'Academic', 'Music', 'Art', 'Social', 'Other']

export default function CreateEventScreen() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [venue, setVenue] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [category, setCategory] = useState('')
  const [coverUri, setCoverUri] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.75,
    })
    if (!result.canceled) setCoverUri(result.assets[0].uri)
  }

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Title required'); return }
    if (!startsAt.trim()) { Alert.alert('Start date/time required'); return }

    // Parse date — accept common formats e.g. "2026-05-10 14:00"
    const parsedStart = new Date(startsAt)
    if (isNaN(parsedStart.getTime())) {
      Alert.alert('Invalid date', 'Use format: YYYY-MM-DD HH:MM')
      return
    }

    setSubmitting(true)
    try {
      let coverImageUrl: string | undefined
      if (coverUri) {
        const { data, error } = await uploadEventCover(coverUri)
        if (error) throw error
        coverImageUrl = data ?? undefined
      }

      const { error } = await createEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        venue: venue.trim() || undefined,
        startsAt: parsedStart.toISOString(),
        endsAt: endsAt.trim() ? new Date(endsAt).toISOString() : undefined,
        category: category || undefined,
        coverImageUrl,
      })
      if (error) throw error
      router.back()
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? JSON.stringify(err) ?? 'Could not create event.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color="rgba(240,240,255,0.6)" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Create Event</Text>
          <TouchableOpacity
            style={[s.submitBtn, (!title.trim() || !startsAt.trim() || submitting) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!title.trim() || !startsAt.trim() || submitting}>
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.submitBtnText}>Create</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Cover image */}
          <TouchableOpacity style={s.coverPicker} onPress={pickCover}>
            {coverUri ? (
              <>
                <Image source={{ uri: coverUri }} style={s.coverImg} resizeMode="cover" />
                <View style={s.coverOverlay}>
                  <Ionicons name="camera-outline" size={24} color="#fff" />
                  <Text style={s.coverOverlayText}>Change cover</Text>
                </View>
              </>
            ) : (
              <View style={s.coverPlaceholder}>
                <Ionicons name="image-outline" size={32} color="rgba(240,240,255,0.2)" />
                <Text style={s.coverPlaceholderText}>Add cover image</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={s.fields}>
            <Field label="Event title *" value={title} onChangeText={setTitle} placeholder="e.g. Tech Expo 2026" />
            <Field label="Description" value={description} onChangeText={setDescription} placeholder="Tell people what to expect..." multiline />
            <Field label="Venue / Location" value={venue} onChangeText={setVenue} placeholder="e.g. Engineering Hall" />
            <Field label="Start date & time *" value={startsAt} onChangeText={setStartsAt} placeholder="YYYY-MM-DD HH:MM" />
            <Field label="End date & time" value={endsAt} onChangeText={setEndsAt} placeholder="YYYY-MM-DD HH:MM (optional)" />

            {/* Category selector */}
            <Text style={s.fieldLabel}>Category</Text>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[s.catPill, category === cat && s.catPillActive]}
                  onPress={() => setCategory(category === cat ? '' : cat)}>
                  <Text style={[s.catPillText, category === cat && s.catPillTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

interface FieldProps {
  label: string
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  multiline?: boolean
}

function Field({ label, value, onChangeText, placeholder, multiline }: FieldProps) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(240,240,255,0.25)"
        multiline={multiline}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  submitBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 7, minWidth: 68, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  scrollContent: { paddingBottom: 40 },
  coverPicker: {
    height: 160, marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  coverImg: { width: '100%', height: '100%' },
  coverOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  coverOverlayText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  coverPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  coverPlaceholderText: { fontSize: 13, color: 'rgba(240,240,255,0.3)' },
  fields: { paddingHorizontal: 16, paddingTop: 16, gap: 4 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, color: 'rgba(240,240,255,0.4)', marginBottom: 6, fontWeight: '500' },
  fieldInput: {
    backgroundColor: '#1c1c2e', borderRadius: 12,
    padding: 13, fontSize: 14, color: '#f0f0ff',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  catPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  catPillActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  catPillText: { fontSize: 12, color: 'rgba(240,240,255,0.45)' },
  catPillTextActive: { color: '#a78bfa', fontWeight: '500' },
})
