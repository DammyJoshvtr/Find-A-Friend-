/**
 * app/create-post.tsx
 * Create post screen — text, image picker, hashtag detection, post type selector.
 */
import React, { useState, useRef, useEffect } from 'react'
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
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { createPost } from '../lib/feed'
import { getClubs } from '../lib/clubs'
import { client } from '../lib/aws'
import { getCurrentUser } from 'aws-amplify/auth'
import { uploadFile } from '../lib/upload'
import type { Club } from '../lib/clubs'
import { useTheme } from '../lib/theme'
import { useFeedStore } from '../store/feedStore'
import { typography } from '../lib/typography'



type PostType = 'feed' | 'club' | 'academic'

const POST_TYPES: { label: string; value: PostType; icon: string }[] = [
  { label: 'Feed', value: 'feed', icon: 'home-outline' },
  { label: 'Club', value: 'club', icon: 'people-outline' },
  { label: 'Academic', value: 'academic', icon: 'school-outline' },
]

export default function CreatePostScreen() {
  const theme = useTheme()
  const { clubId } = useLocalSearchParams<{ clubId?: string }>()
  const [body, setBody] = useState('')
  const [imageUris, setImageUris] = useState<string[]>([])
  const [postType, setPostType] = useState<PostType>('feed')
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [loadingClubs, setLoadingClubs] = useState(false)
  const [posting, setPosting] = useState(false)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (clubId) {
      setPostType('club')
      setLoadingClubs(true)
      getClubs().then(({ data }) => {
        if (data) {
          setClubs(data)
          const target = data.find(c => c.id === clubId)
          if (target) setSelectedClub(target)
        }
        setLoadingClubs(false)
      })
    }
  }, [clubId])

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
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 4 - imageUris.length,
      allowsEditing: false,
      quality: 0.75,
    })
    if (!result.canceled) {
      const selected = result.assets.map(asset => asset.uri)
      setImageUris(prev => [...prev, ...selected].slice(0, 4))
    }
  }

  const uploadMedia = async (uri: string): Promise<string> => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
    const randomStr = Math.random().toString(36).substring(7)
    const path = `${user.userId}/${Date.now()}-${randomStr}.${ext}`
    const isVideo = ['mp4', 'mov', 'm4v', '3gp'].includes(ext)
    const mimeType = isVideo ? `video/${ext === 'mov' ? 'quicktime' : 'mp4'}` : `image/${ext === 'jpg' ? 'jpeg' : ext}`

    return await uploadFile('posts-media', path, uri, mimeType)
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
      if (imageUris.length > 0) {
        if (imageUris.length === 1) {
          imageUrl = await uploadMedia(imageUris[0])
        } else {
          const uploaded = await Promise.all(imageUris.map(uri => uploadMedia(uri)))
          imageUrl = JSON.stringify(uploaded)
        }
      }

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
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.closeBtn, { backgroundColor: theme.card }]}>
          <Ionicons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>New Post</Text>
        <TouchableOpacity
          style={[s.postBtn, { backgroundColor: theme.accent }, (!body.trim() || posting) && s.postBtnDisabled]}
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
                style={[s.typeBtn, { backgroundColor: theme.card, borderColor: theme.border }, postType === t.value && { backgroundColor: theme.accent + '20', borderColor: theme.accent }]}
                onPress={() => handleTypeChange(t.value)}>
                <Ionicons
                  name={t.icon as any}
                  size={14}
                  color={postType === t.value ? theme.accent : theme.textMuted}
                />
                <Text style={[s.typeBtnText, { color: theme.textMuted }, postType === t.value && { color: theme.accent, fontWeight: '500' }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Club picker */}
          {postType === 'club' && (
            <View style={s.clubSection}>
              <Text style={[s.clubLabel, { color: theme.textMuted }]}>Post to club</Text>
              {loadingClubs ? (
                <ActivityIndicator color={theme.accent} style={{ marginVertical: 8 }} />
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
                        { backgroundColor: theme.card, borderColor: theme.border },
                        selectedClub?.id === club.id && { backgroundColor: theme.accent + '20', borderColor: theme.accent },
                      ]}
                      onPress={() => setSelectedClub(club)}>
                      <Text
                        style={[
                          s.clubPillText,
                          { color: theme.textMuted },
                          selectedClub?.id === club.id && { color: theme.accent, fontWeight: '500' },
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
              style={[s.textInput, { color: theme.text }]}
              placeholder="What's on your mind? Use #hashtags..."
              placeholderTextColor={theme.textFaint}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={500}
              autoFocus
              textAlignVertical="top"
            />
            <Text style={[s.charCount, { color: theme.textFaint }]}>{body.length}/500</Text>
          </View>

          {/* Media preview */}
          {imageUris.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {imageUris.map((uri, index) => (
                  <View key={index} style={{ position: 'relative', width: 90, height: 90, borderRadius: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: theme.border }}>
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                    <TouchableOpacity
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
                        width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
                      }}
                      onPress={() => setImageUris(prev => prev.filter((_, idx) => idx !== index))}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {imageUris.length < 4 && (
                  <TouchableOpacity
                    onPress={pickImage}
                    style={{
                      width: 90, height: 90, borderRadius: 12,
                      borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
                      alignItems: 'center', justifyContent: 'center', backgroundColor: theme.card,
                    }}
                  >
                    <Ionicons name="camera-outline" size={24} color={theme.textMuted} />
                    <Text style={{ fontSize: 9, color: theme.textMuted, marginTop: 4, fontFamily: typography.fontMedium }}>Add {4 - imageUris.length} more</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}

          {/* Media button */}
          {imageUris.length === 0 && (
            <TouchableOpacity style={[s.mediaBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={pickImage}>
              <Ionicons name="image-outline" size={18} color={theme.textMuted} />
              <Text style={[s.mediaBtnText, { color: theme.textMuted }]}>Add photo (4 max)</Text>
            </TouchableOpacity>
          )}
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
