import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import Toast from 'react-native-toast-message'
import { getCurrentProfile, updateProfile, uploadAvatar, uploadCover } from '../lib/profiles'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import { getInitials } from '../lib/matching'
import type { Profile } from '../lib/profiles'

const DEPARTMENTS = [
  'Engineering', 'Medicine', 'Law', 'Sciences', 'Arts',
  'Social Sciences', 'Education', 'Business', 'Agriculture',
]

const LEVELS = ['100L', '200L', '300L', '400L', '500L', '600L', 'Postgrad']

export default function EditProfileScreen() {
  const theme = useTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [department, setDepartment] = useState('')
  const [level, setLevel] = useState('')
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [coverUri, setCoverUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCurrentProfile()
      .then(p => {
        if (p) {
          setProfile(p)
          setFullName(p.full_name ?? '')
          setBio(p.bio ?? '')
          setDepartment(p.department ?? '')
          setLevel(p.level ?? '')
        }
      })
      .catch(() => {
        // Non-fatal
      })
      .finally(() => setLoading(false))
  }, [])

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission needed', text2: 'Allow access to your photos.' })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    })
    if (!result.canceled) setAvatarUri(result.assets[0].uri)
  }

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission needed', text2: 'Allow access to your photos.' })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    })
    if (!result.canceled) setCoverUri(result.assets[0].uri)
  }

  const handleSave = async () => {
    if (!fullName.trim()) {
      Toast.show({ type: 'error', text1: 'Name required', text2: 'Please enter your full name.' })
      return
    }
    setSaving(true)
    try {
      let avatarUrl = profile?.avatar_url ?? undefined

      if (avatarUri) {
        const { data, error } = await uploadAvatar(avatarUri)
        if (error) throw error
        // Add cache-bust so the new image loads immediately on this device
        avatarUrl = data ? `${data}?t=${Date.now()}` : avatarUrl
      }

      let coverUrl = profile?.cover_url ?? undefined

      if (coverUri) {
        const { data, error } = await uploadCover(coverUri)
        if (error) throw error
        // Add cache-bust so the new image loads immediately on this device
        coverUrl = data ? `${data}?t=${Date.now()}` : coverUrl
      }

      const { error } = await updateProfile({
        full_name: fullName.trim(),
        bio: bio.trim() || undefined,
        department: department.trim() || undefined,
        level: level || undefined,
        avatar_url: avatarUrl ?? undefined,
        cover_url: coverUrl ?? undefined,
      })
      if (error) throw new Error(String(error))

      // Update local state immediately so the change is visible on THIS device
      setProfile(prev => prev ? {
        ...prev,
        full_name: fullName.trim(),
        bio: bio.trim() || null,
        department: department.trim() || null,
        level: level || null,
        avatar_url: avatarUrl ?? prev.avatar_url,
        cover_url: coverUrl ?? prev.cover_url,
      } : prev)
      // Also clear the local image URIs since they are now saved
      setAvatarUri(null)
      setCoverUri(null)

      Toast.show({ type: 'success', text1: 'Profile updated!', text2: 'Your changes are saved.' })
      router.back()
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err instanceof Error ? err.message : 'Could not save profile.' })
    } finally {
      setSaving(false)
    }
  }


  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  const avatarSource = avatarUri ?? profile?.avatar_url
  const initials = getInitials(fullName || profile?.full_name || 'U')

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={[s.closeBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 0.5 }]}>
            <Ionicons name="close" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.title, { color: theme.text }]}>Edit Profile</Text>
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: theme.accent }, saving && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Cover image picker */}
          <TouchableOpacity style={[s.coverPicker, { borderBottomColor: theme.border, backgroundColor: theme.card2 }]} onPress={pickCover}>
            {coverUri || profile?.cover_url ? (
              <>
                <Image source={{ uri: coverUri ?? profile?.cover_url ?? '' }} style={s.coverImg} resizeMode="cover" />
                <View style={s.coverDim}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, marginTop: 3 }}>Change cover image</Text>
                </View>
              </>
            ) : (
              <View style={s.coverEmpty}>
                <Ionicons name="image-outline" size={24} color={theme.textFaint} />
                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>Add cover image</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Avatar */}
          <View style={s.avatarSection}>
            <TouchableOpacity style={s.avatarWrap} onPress={pickAvatar}>
              {avatarSource ? (
                <Image source={{ uri: avatarSource }} style={s.avatar} />
              ) : (
                <View style={[s.avatarFallback, { backgroundColor: theme.cardSolid, borderColor: theme.accent }]}>
                  <Text style={[s.avatarInitials, { color: theme.accent }]}>{initials}</Text>
                </View>
              )}
              <View style={[s.avatarEdit, { borderColor: theme.bg, backgroundColor: theme.accent }]}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={[s.avatarHint, { color: theme.textFaint }]}>Tap to change photo</Text>
          </View>

          {/* Fields */}
          <View style={s.fields}>
            <Field
              label="Full name *"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              textColor={theme.text}
            />
            <Field
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Tell campus about yourself..."
              multiline
              maxLength={160}
              textColor={theme.text}
            />

            {/* Department */}
            <Text style={[s.fieldLabel, { color: theme.textMuted }]}>Department</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.pillRow}
              style={{ marginBottom: 12 }}>
              {DEPARTMENTS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.pill, { backgroundColor: theme.card, borderColor: theme.border }, department === d && [s.pillActive, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]]}
                  onPress={() => setDepartment(d)}>
                  <Text style={[s.pillText, { color: theme.textMuted }, department === d && [s.pillTextActive, { color: theme.accent }]]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.fieldWrap}>
              <TextInput
                style={[s.input, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text }]}
                placeholder="Enter your department manually"
                placeholderTextColor={theme.textFaint}
                value={department}
                onChangeText={setDepartment}
              />
            </View>

            {/* Level */}
            <Text style={[s.fieldLabel, { marginTop: 16, color: theme.textMuted }]}>Level</Text>
            <View style={s.levelRow}>
              {LEVELS.map(l => (
                <TouchableOpacity
                  key={l}
                  style={[s.levelBtn, { backgroundColor: theme.card, borderColor: theme.border }, level === l && [s.levelBtnActive, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]]}
                  onPress={() => setLevel(level === l ? '' : l)}>
                  <Text style={[s.levelText, { color: theme.textMuted }, level === l && [s.levelTextActive, { color: theme.accent }]]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Field({ label, value, onChangeText, placeholder, multiline, maxLength, textColor }: {
  label: string; value: string; onChangeText: (t: string) => void
  placeholder?: string; multiline?: boolean; maxLength?: number; textColor?: string
}) {
  const theme = useTheme()
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <TextInput
        style={[s.input, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text }, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textFaint}
        multiline={multiline}
        maxLength={maxLength}
      />
      {maxLength && (
        <Text style={[s.charCount, { color: theme.textFaint }]}>{value.length}/{maxLength}</Text>
      )}
    </View>
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
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontFamily: typography.fontSemiBold, color: '#f0f0ff' },
  saveBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 18, minHeight: 44, minWidth: 60, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 13, fontFamily: typography.fontBold, color: '#fff' },
  scroll: { paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingTop: 28, paddingBottom: 20 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#2a1e40', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#a78bfa',
  },
  avatarInitials: { fontSize: 28, fontFamily: typography.fontBold, color: '#c4b5fd' },
  avatarEdit: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0d0d14',
  },
  avatarHint: { fontSize: 12, color: 'rgba(240,240,255,0.35)', marginTop: 10, fontFamily: typography.fontRegular },
  fields: { paddingHorizontal: 16, gap: 4 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, color: 'rgba(240,240,255,0.4)', marginBottom: 8, fontFamily: typography.fontMedium },
  input: {
    backgroundColor: '#1c1c2e', borderRadius: 12,
    padding: 13, fontSize: 14, color: '#f0f0ff',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', fontFamily: typography.fontRegular,
  },
  charCount: { fontSize: 10, color: 'rgba(240,240,255,0.25)', textAlign: 'right', marginTop: 4, fontFamily: typography.fontRegular },
  pillRow: { gap: 8, paddingBottom: 4 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  pillActive: { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.4)' },
  pillText: { fontSize: 12, color: 'rgba(240,240,255,0.45)', fontFamily: typography.fontRegular },
  pillTextActive: { color: '#a78bfa', fontFamily: typography.fontSemiBold },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  levelBtnActive: { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.4)' },
  levelText: { fontSize: 13, color: 'rgba(240,240,255,0.45)', fontFamily: typography.fontRegular },
  levelTextActive: { color: '#a78bfa', fontFamily: typography.fontSemiBold },
  coverPicker: {
    height: 120,
    width: '100%',
    backgroundColor: 'rgba(167,139,250,0.04)',
    borderBottomWidth: 0.5,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

