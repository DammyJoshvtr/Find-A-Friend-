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
import { getCurrentProfile, updateProfile, uploadAvatar } from '../lib/profiles'
import { getInitials } from '../lib/matching'
import type { Profile } from '../lib/profiles'

const DEPARTMENTS = [
  'Engineering', 'Medicine', 'Law', 'Sciences', 'Arts',
  'Social Sciences', 'Education', 'Business', 'Agriculture', 'Other',
]

const LEVELS = ['100L', '200L', '300L', '400L', '500L', '600L', 'Postgrad']

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [department, setDepartment] = useState('')
  const [level, setLevel] = useState('')
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCurrentProfile().then(p => {
      if (p) {
        setProfile(p)
        setFullName(p.full_name ?? '')
        setBio(p.bio ?? '')
        setDepartment(p.department ?? '')
        setLevel(p.level ?? '')
      }
      setLoading(false)
    })
  }, [])

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.8,
    })
    if (!result.canceled) setAvatarUri(result.assets[0].uri)
  }

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name required', 'Please enter your full name.')
      return
    }
    setSaving(true)
    try {
      let avatarUrl = profile?.avatar_url

      if (avatarUri) {
        const { data, error } = await uploadAvatar(avatarUri)
        if (error) throw error
        avatarUrl = data ?? avatarUrl
      }

      const { error } = await updateProfile({
        full_name: fullName.trim(),
        bio: bio.trim() || undefined,
        department: department || undefined,
        level: level || undefined,
        avatar_url: avatarUrl ?? undefined,
      })
      if (error) throw new Error(String(error))
      router.back()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator color="#a78bfa" style={{ flex: 1 }} />
      </SafeAreaView>
    )
  }

  const avatarSource = avatarUri ?? profile?.avatar_url
  const initials = getInitials(fullName || profile?.full_name || 'U')

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color="rgba(240,240,255,0.6)" />
          </TouchableOpacity>
          <Text style={s.title}>Edit Profile</Text>
          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
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

          {/* Avatar */}
          <View style={s.avatarSection}>
            <TouchableOpacity style={s.avatarWrap} onPress={pickAvatar}>
              {avatarSource ? (
                <Image source={{ uri: avatarSource }} style={s.avatar} />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={s.avatarEdit}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={s.avatarHint}>Tap to change photo</Text>
          </View>

          {/* Fields */}
          <View style={s.fields}>
            <Field
              label="Full name *"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
            />
            <Field
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Tell campus about yourself..."
              multiline
              maxLength={160}
            />

            {/* Department */}
            <Text style={s.fieldLabel}>Department</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.pillRow}>
              {DEPARTMENTS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.pill, department === d && s.pillActive]}
                  onPress={() => setDepartment(department === d ? '' : d)}>
                  <Text style={[s.pillText, department === d && s.pillTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Level */}
            <Text style={[s.fieldLabel, { marginTop: 16 }]}>Level</Text>
            <View style={s.levelRow}>
              {LEVELS.map(l => (
                <TouchableOpacity
                  key={l}
                  style={[s.levelBtn, level === l && s.levelBtnActive]}
                  onPress={() => setLevel(level === l ? '' : l)}>
                  <Text style={[s.levelText, level === l && s.levelTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Field({ label, value, onChangeText, placeholder, multiline, maxLength }: {
  label: string; value: string; onChangeText: (t: string) => void
  placeholder?: string; multiline?: boolean; maxLength?: number
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(240,240,255,0.25)"
        multiline={multiline}
        maxLength={maxLength}
      />
      {maxLength && (
        <Text style={s.charCount}>{value.length}/{maxLength}</Text>
      )}
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
  title: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  saveBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 7, minWidth: 60, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  scroll: { paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingTop: 28, paddingBottom: 20 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#2a1e40', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#a78bfa',
  },
  avatarInitials: { fontSize: 28, fontWeight: '700', color: '#c4b5fd' },
  avatarEdit: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0d0d14',
  },
  avatarHint: { fontSize: 12, color: 'rgba(240,240,255,0.35)', marginTop: 10 },
  fields: { paddingHorizontal: 16, gap: 4 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, color: 'rgba(240,240,255,0.4)', marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: '#1c1c2e', borderRadius: 12,
    padding: 13, fontSize: 14, color: '#f0f0ff',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  charCount: { fontSize: 10, color: 'rgba(240,240,255,0.25)', textAlign: 'right', marginTop: 4 },
  pillRow: { gap: 8, paddingBottom: 4 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  pillActive: { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.4)' },
  pillText: { fontSize: 12, color: 'rgba(240,240,255,0.45)' },
  pillTextActive: { color: '#a78bfa', fontWeight: '600' },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  levelBtnActive: { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.4)' },
  levelText: { fontSize: 13, color: 'rgba(240,240,255,0.45)' },
  levelTextActive: { color: '#a78bfa', fontWeight: '600' },
})
