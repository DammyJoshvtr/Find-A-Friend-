/**
 * app/create-event.tsx
 * Create event form — plain TextInput for date & time. No native modules.
 */
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Image, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { createEvent, uploadEventCover } from '../lib/events'
import { useTheme } from '../lib/theme'
import { friendlyErrorMessage } from '../lib/errorUtils'

const CATEGORIES = [
  'Technology', 'Sports', 'Culture', 'Academic',
  'Music', 'Art', 'Social', 'Other',
]

/** Parse "YYYY-MM-DD HH:MM" or "YYYY-MM-DDTHH:MM" → Date | null */
function parseDateTime(raw: string): Date | null {
  if (!raw.trim()) return null
  const normalised = raw.trim().replace(' ', 'T')
  const d = new Date(normalised)
  return isNaN(d.getTime()) ? null : d
}

/** Format Date → "YYYY-MM-DD HH:MM" for the text input */
function toInputString(d: Date | null): string {
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function CreateEventScreen() {
  const theme = useTheme()
  const { clubId } = useLocalSearchParams<{ clubId?: string }>()

  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [venue, setVenue]           = useState('')
  const [category, setCategory]     = useState('')
  const [coverUri, setCoverUri]     = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Date/time as editable strings
  const defaultStart = new Date(Date.now() + 3600000)
  const [startsAtText, setStartsAtText] = useState(toInputString(defaultStart))
  const [endsAtText,   setEndsAtText]   = useState('')

  // Validation helpers
  const startsAtDate = parseDateTime(startsAtText)
  const endsAtDate   = parseDateTime(endsAtText)
  const startValid   = startsAtDate !== null
  const canSubmit    = title.trim().length > 0 && startValid && !submitting

  // ── Image picker ──────────────────────────────────────────────────────────
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

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Title required'); return }
    if (!startsAtDate) {
      Alert.alert('Invalid start date', 'Enter date as YYYY-MM-DD HH:MM, e.g. 2026-07-20 14:30')
      return
    }
    if (endsAtText.trim() && !endsAtDate) {
      Alert.alert('Invalid end date', 'Enter date as YYYY-MM-DD HH:MM, e.g. 2026-07-20 16:00')
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
        title:        title.trim(),
        description:  description.trim() || undefined,
        venue:        venue.trim() || undefined,
        startsAt:     startsAtDate.toISOString(),
        endsAt:       endsAtDate ? endsAtDate.toISOString() : undefined,
        category:     category || undefined,
        coverImageUrl,
        clubId:       clubId || undefined,
      })
      if (error) throw error
      router.back()
    } catch (err: unknown) {
      Alert.alert('Event creation failed', friendlyErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color="rgba(240,240,255,0.6)" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Create Event</Text>
          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnOff]}
            onPress={handleSubmit}
            disabled={!canSubmit}>
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.submitBtnText}>Create</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Cover image ─────────────────────────────────────────────── */}
          <TouchableOpacity style={s.coverBox} onPress={pickCover}>
            {coverUri ? (
              <>
                <Image source={{ uri: coverUri }} style={s.coverImg} resizeMode="cover" />
                <View style={s.coverDim}>
                  <Ionicons name="camera-outline" size={24} color="#fff" />
                  <Text style={s.coverDimText}>Change cover</Text>
                </View>
              </>
            ) : (
              <View style={s.coverEmpty}>
                <Ionicons name="image-outline" size={32} color="rgba(240,240,255,0.2)" />
                <Text style={s.coverEmptyText}>Add cover image</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ── Fields ──────────────────────────────────────────────────── */}
          <View style={s.fields}>

            <Field
              label="Event title *"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Tech Expo 2026"
            />

            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Tell people what to expect..."
              multiline
            />

            <Field
              label="Venue / Location"
              value={venue}
              onChangeText={setVenue}
              placeholder="e.g. Engineering Hall"
            />

            {/* ── Start date/time ── */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Start date & time *</Text>
              <View style={[s.dateRow, !startValid && startsAtText.length > 0 && s.dateRowError]}>
                <Ionicons name="calendar-outline" size={16} color={startValid ? '#a78bfa' : 'rgba(240,240,255,0.3)'} style={{ marginRight: 8 }} />
                <TextInput
                  style={s.dateInput}
                  value={startsAtText}
                  onChangeText={setStartsAtText}
                  placeholder="YYYY-MM-DD HH:MM"
                  placeholderTextColor="rgba(240,240,255,0.25)"
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={16}
                />
                {startValid && (
                  <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                )}
              </View>
              {!startValid && startsAtText.length > 0 && (
                <Text style={s.hint}>Format: YYYY-MM-DD HH:MM (e.g. 2026-07-20 14:30)</Text>
              )}
            </View>

            {/* ── End date/time ── */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>End date & time (optional)</Text>
              <View style={[s.dateRow, endsAtText.length > 0 && !endsAtDate && s.dateRowError]}>
                <Ionicons name="calendar-outline" size={16} color={endsAtDate ? '#a78bfa' : 'rgba(240,240,255,0.3)'} style={{ marginRight: 8 }} />
                <TextInput
                  style={s.dateInput}
                  value={endsAtText}
                  onChangeText={setEndsAtText}
                  placeholder="YYYY-MM-DD HH:MM (optional)"
                  placeholderTextColor="rgba(240,240,255,0.25)"
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={16}
                />
                {endsAtDate && (
                  <TouchableOpacity onPress={() => setEndsAtText('')}>
                    <Ionicons name="close-circle" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
              {endsAtText.length > 0 && !endsAtDate && (
                <Text style={s.hint}>Format: YYYY-MM-DD HH:MM (e.g. 2026-07-20 16:00)</Text>
              )}
            </View>

            {/* ── Category ── */}
            <Text style={[s.label, { marginTop: 4 }]}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[s.pill, category === cat && s.pillActive]}
                  onPress={() => setCategory(category === cat ? '' : cat)}>
                  <Text style={[s.pillText, category === cat && s.pillTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Reusable text field ───────────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, multiline }: {
  label: string
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(240,240,255,0.25)"
        multiline={multiline}
      />
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
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
  submitBtnOff: { opacity: 0.4 },
  submitBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Scroll
  scroll: { paddingBottom: 48 },

  // Cover
  coverBox: {
    height: 160, marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#1c1c2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  coverImg: { width: '100%', height: '100%' },
  coverDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  coverDimText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  coverEmptyText: { fontSize: 13, color: 'rgba(240,240,255,0.3)' },

  // Fields
  fields: { paddingHorizontal: 16, paddingTop: 20, gap: 4 },
  fieldWrap: { marginBottom: 16 },
  label: {
    fontSize: 11, color: 'rgba(240,240,255,0.4)',
    marginBottom: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1c1c2e', borderRadius: 12,
    padding: 13, fontSize: 14, color: '#f0f0ff',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },

  // Date row
  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1c1c2e', borderRadius: 12,
    paddingHorizontal: 13, paddingVertical: 3,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  dateRowError: { borderColor: '#ef4444' },
  dateInput: {
    flex: 1, fontSize: 14, color: '#f0f0ff',
    paddingVertical: 10,
  },
  hint: {
    fontSize: 10, color: '#ef4444', marginTop: 4, marginLeft: 2,
  },

  // Category pills
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#1c1c2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  pillActive: {
    backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.4)',
  },
  pillText: { fontSize: 12, color: 'rgba(240,240,255,0.45)' },
  pillTextActive: { color: '#a78bfa', fontWeight: '600' },
})
