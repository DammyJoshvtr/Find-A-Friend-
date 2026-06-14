/**
 * app/vendor-apply.tsx
 * Vendor application form — name, category, description, location.
 */
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { applyAsVendor, uploadVendorCover } from '../lib/vendors'
import { useTheme } from '../lib/theme'
import * as ImagePicker from 'expo-image-picker'
import { friendlyErrorMessage } from '../lib/errorUtils'

const CATEGORIES = ['Food', 'Fashion', 'Tech', 'Beauty', 'Books', 'Health', 'Services']

const EMOJI_OPTIONS = ['🏪', '🍔', '👗', '💻', '💄', '📚', '💊', '🔧', '☕', '🎵', '🏋️', '✂️']

export default function VendorApplyScreen() {
  const theme = useTheme()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [locationText, setLocationText] = useState('')
  const [icon, setIcon] = useState('🏪')
  const [submitting, setSubmitting] = useState(false)
  const [coverUri, setCoverUri] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && category.length > 0 && locationText.trim().length > 0

  const handlePickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      let finalCoverUrl: string | undefined = undefined
      if (coverUri) {
        const { data: uploadUrl, error: uploadErr } = await uploadVendorCover(coverUri)
        if (uploadErr) throw uploadErr
        if (uploadUrl) finalCoverUrl = uploadUrl
      }

      const { data, error } = await applyAsVendor({
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        icon,
        locationText: locationText.trim(),
        cover_url: finalCoverUrl,
      })
      if (error) throw error
      Alert.alert(
        'Application Submitted!',
        'Your vendor application is under review. You will be notified once approved.',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    } catch (err: unknown) {
      Alert.alert('Application failed', friendlyErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color="rgba(240,240,255,0.6)" />
          </TouchableOpacity>
          <Text style={s.title}>Become a Vendor</Text>
          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}>
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.submitText}>Apply</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Info banner */}
          <View style={s.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#fbbf24" />
            <Text style={s.infoText}>
              Applications are reviewed within 24-48 hours. Approved vendors can post deals and be discovered by all students on campus.
            </Text>
          </View>

          {/* Icon picker */}
          <Text style={s.label}>Business Icon</Text>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.emojiRow}>
            {EMOJI_OPTIONS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={[s.emojiBtn, icon === emoji && s.emojiBtnActive]}
                onPress={() => setIcon(emoji)}>
                <Text style={s.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Cover Image */}
          <Text style={s.label}>Cover Image <Text style={s.optional}>(optional)</Text></Text>
          <TouchableOpacity style={s.coverPicker} onPress={handlePickCover}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={s.coverPreview} />
            ) : (
              <View style={s.coverPlaceholder}>
                <Ionicons name="image-outline" size={32} color="rgba(240,240,255,0.2)" />
                <Text style={s.coverPlaceholderText}>Tap to add cover photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Business name */}
          <Text style={s.label}>Business Name <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Campus Bites"
            placeholderTextColor="rgba(240,240,255,0.25)"
            value={name}
            onChangeText={setName}
            maxLength={60}
          />

          {/* Category */}
          <Text style={s.label}>Category <Text style={s.required}>*</Text></Text>
          <View style={s.catGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[s.catChip, category === cat && s.catChipActive]}
                onPress={() => setCategory(cat)}>
                <Text style={[s.catChipText, category === cat && s.catChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Location */}
          <Text style={s.label}>Location / Address <Text style={s.required}>*</Text></Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Main Campus, Block C"
            placeholderTextColor="rgba(240,240,255,0.25)"
            value={locationText}
            onChangeText={setLocationText}
            maxLength={100}
          />

          {/* Description */}
          <Text style={s.label}>Description <Text style={s.optional}>(optional)</Text></Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="Tell students about your business..."
            placeholderTextColor="rgba(240,240,255,0.25)"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{description.length}/300</Text>

          {/* Terms */}
          <View style={s.terms}>
            <Ionicons name="shield-checkmark-outline" size={14} color="rgba(240,240,255,0.3)" />
            <Text style={s.termsText}>
              By applying, you agree to FAF's vendor terms of service. Deals must be legitimate student discounts offered at this business.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  submitBtn: {
    backgroundColor: '#fbbf24', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 7, minWidth: 60, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: 13, fontWeight: '700', color: '#000' },
  scroll: { padding: 16, paddingBottom: 40 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 12, padding: 12, marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.2)',
  },
  infoText: { flex: 1, fontSize: 12, color: 'rgba(251,191,36,0.8)', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', color: 'rgba(240,240,255,0.6)', marginBottom: 8 },
  required: { color: '#ef4444' },
  optional: { color: 'rgba(240,240,255,0.25)', fontWeight: '400' },
  input: {
    backgroundColor: '#1c1c2e', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#f0f0ff', marginBottom: 16,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  textArea: { minHeight: 90, lineHeight: 20 },
  charCount: { fontSize: 10, color: 'rgba(240,240,255,0.25)', textAlign: 'right', marginTop: -12, marginBottom: 16 },
  emojiRow: { gap: 8, marginBottom: 16 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  emojiBtnActive: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderColor: 'rgba(251,191,36,0.4)',
  },
  emojiText: { fontSize: 22 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#1c1c2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  catChipActive: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderColor: 'rgba(251,191,36,0.4)',
  },
  catChipText: { fontSize: 12, color: 'rgba(240,240,255,0.5)' },
  catChipTextActive: { color: '#fbbf24', fontWeight: '600' },
  terms: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#1c1c2e', borderRadius: 10, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  termsText: { flex: 1, fontSize: 11, color: 'rgba(240,240,255,0.3)', lineHeight: 16 },
  coverPicker: {
    height: 120, borderRadius: 12, backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16, overflow: 'hidden',
  },
  coverPreview: { width: '100%', height: '100%' },
  coverPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  coverPlaceholderText: {
    fontSize: 12, color: 'rgba(240,240,255,0.4)', fontWeight: '500',
  },
})

