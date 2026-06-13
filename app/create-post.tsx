/**
 * app/create-post.tsx
 * Create post screen — text, image picker, hashtag detection, post type selector.
 */
import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { createPost } from '../lib/feed'
import { getClubs } from '../lib/clubs'
import { supabase } from '../lib/supabase'
import type { Club } from '../lib/clubs'
import { useTheme } from '../lib/theme'
import { useFeedStore } from '../store/feedStore'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://vcbtvhociaioeyhhsczh.supabase.co'

type PostType = 'feed' | 'club' | 'academic'

const POST_TYPES: { label: string; value: PostType; icon: string }[] = [
  { label: 'Feed', value: 'feed', icon: 'home-outline' },
  { label: 'Club', value: 'club', icon: 'people-outline' },
  { label: 'Academic', value: 'academic', icon: 'school-outline' },
]

export default function CreatePostScreen() {
  const theme = useTheme()
  const [body, setBody] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [postType, setPostType] = useState<PostType>('feed')
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [loadingClubs, setLoadingClubs] = useState(false)
  const [posting, setPosting] = useState(false)
  const inputRef = useRef<TextInput>(null)

  const handleTypeChange = async (type: PostType) => {
    setPostType(type)
    if (type === 'club' && clubs.length === 0) {
      setLoadingClubs(true)
      const { data } = await getClubs()
      setClubs(data ?? [])
      setLoadingClubs(false)
    }
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.75,
    })
    if (!result.canceled) setImageUri(result.assets[0].uri)
  }

  const uploadImage = async (uri: string): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    const ext = uri.split('.').pop() ?? 'jpg'
    const path = `${session.user.id}/${Date.now()}.${ext}`
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

    const formData = new FormData()
    formData.append('file', { uri, name: `upload.${ext}`, type: mimeType } as any)

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/posts-media/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'x-upsert': 'false' },
      body: formData,
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => `HTTP ${res.status}`)
      throw new Error(`Image upload failed: ${msg}`)
    }
    const { data } = supabase.storage.from('posts-media').getPublicUrl(path)
    return data.publicUrl
  }

  const handlePost = async () => {
    const trimmed = body.trim()
    if (!trimmed) {
      Alert.alert('Empty post', 'Write something before posting.')
      return
    }
    if (postType === 'club' && !selectedClub) {
      Alert.alert('Select a club', 'Choose which club to post in.')
      return
    }
    setPosting(true)
    try {
      let imageUrl: string | null = null
      if (imageUri) imageUrl = await uploadImage(imageUri)

      const { error } = await createPost({
        body: trimmed,
        imageUrl,
        postType: postType === 'academic' ? 'academic' : postType === 'club' ? 'club' : 'feed',
        clubId: postType === 'club' ? selectedClub?.id : null,
        isAnonymous: false,
      })
      if (error) throw error
      
      if (postType === 'feed') {
        useFeedStore.getState().refresh()
      }
      
      router.back()
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? JSON.stringify(err) ?? 'Unknown error')
    } finally {
      setPosting(false)
    }
  }

  // Render hashtag-highlighted body preview
  const renderHighlightedBody = () => {
    if (!body) return null
    const parts = body.split(/(#\w+)/g)
    return (
      <Text style={s.bodyPreview} pointerEvents="none">
        {parts.map((p, i) =>
          p.startsWith('#') ? (
            <Text key={i} style={s.hashtagHighlight}>{p}</Text>
          ) : (
            <Text key={i} style={{ color: 'transparent' }}>{p}</Text>
          )
        )}
      </Text>
    )
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
          <Ionicons name="close" size={22} color="rgba(240,240,255,0.6)" />
        </TouchableOpacity>
        <Text style={s.title}>New Post</Text>
        <TouchableOpacity
          style={[s.postBtn, (!body.trim() || posting) && s.postBtnDisabled]}
          onPress={handlePost}
          disabled={!body.trim() || posting}>
          {posting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.postBtnText}>Post</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled">

          {/* Post type selector */}
          <View style={s.typeRow}>
            {POST_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[s.typeBtn, postType === t.value && s.typeBtnActive]}
                onPress={() => handleTypeChange(t.value)}>
                <Ionicons
                  name={t.icon as any}
                  size={14}
                  color={postType === t.value ? '#a78bfa' : 'rgba(240,240,255,0.4)'}
                />
                <Text style={[s.typeBtnText, postType === t.value && s.typeBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Club picker */}
          {postType === 'club' && (
            <View style={s.clubSection}>
              <Text style={s.clubLabel}>Post to club</Text>
              {loadingClubs ? (
                <ActivityIndicator color="#a78bfa" style={{ marginVertical: 8 }} />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}>
                  {clubs.map(club => (
                    <TouchableOpacity
                      key={club.id}
                      style={[
                        s.clubPill,
                        selectedClub?.id === club.id && s.clubPillActive,
                      ]}
                      onPress={() => setSelectedClub(club)}>
                      <Text
                        style={[
                          s.clubPillText,
                          selectedClub?.id === club.id && s.clubPillTextActive,
                        ]}>
                        {club.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Text input */}
          <View style={s.inputWrap}>
            <TextInput
              ref={inputRef}
              style={s.textInput}
              placeholder="What's on your mind? Use #hashtags..."
              placeholderTextColor="rgba(240,240,255,0.25)"
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={500}
              autoFocus
              textAlignVertical="top"
            />
            <Text style={s.charCount}>{body.length}/500</Text>
          </View>

          {/* Image preview */}
          {imageUri && (
            <View style={s.imagePreview}>
              <Image source={{ uri: imageUri }} style={s.previewImg} resizeMode="cover" />
              <TouchableOpacity
                style={s.removeImg}
                onPress={() => setImageUri(null)}>
                <Ionicons name="close-circle" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Media button */}
          <TouchableOpacity style={s.mediaBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={18} color="rgba(240,240,255,0.5)" />
            <Text style={s.mediaBtnText}>
              {imageUri ? 'Change photo' : 'Add photo'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1c1c2e',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  postBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 7,
    minWidth: 60, alignItems: 'center',
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  scrollContent: { paddingBottom: 40 },
  typeRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  typeBtnActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  typeBtnText: { fontSize: 12, color: 'rgba(240,240,255,0.4)' },
  typeBtnTextActive: { color: '#a78bfa', fontWeight: '500' },
  clubSection: { paddingHorizontal: 16, marginBottom: 8 },
  clubLabel: { fontSize: 11, color: 'rgba(240,240,255,0.4)', marginBottom: 6 },
  clubPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  clubPillActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  clubPillText: { fontSize: 12, color: 'rgba(240,240,255,0.5)' },
  clubPillTextActive: { color: '#a78bfa', fontWeight: '500' },
  inputWrap: { paddingHorizontal: 16, position: 'relative' },
  textInput: {
    fontSize: 15, color: '#f0f0ff',
    minHeight: 140,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  bodyPreview: {
    position: 'absolute', top: 0, left: 16,
    fontSize: 15, lineHeight: 22,
    pointerEvents: 'none',
  },
  hashtagHighlight: { color: '#a78bfa', fontWeight: '500' },
  charCount: {
    fontSize: 10, color: 'rgba(240,240,255,0.25)',
    textAlign: 'right', marginTop: 4,
  },
  imagePreview: {
    marginHorizontal: 16, marginTop: 12, position: 'relative',
    borderRadius: 12, overflow: 'hidden',
  },
  previewImg: { width: '100%', height: 200, borderRadius: 12 },
  removeImg: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
  },
  mediaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 16,
    padding: 12,
    backgroundColor: '#1c1c2e',
    borderRadius: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  mediaBtnText: { fontSize: 13, color: 'rgba(240,240,255,0.5)' },
})
