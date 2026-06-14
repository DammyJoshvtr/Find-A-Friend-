/**
 * app/create-story.tsx
 * Pick photo/video, preview, and post as a story.
 */
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { createStory, uploadStoryMedia } from '../lib/stories'
import { useStoriesStore } from '../store/storiesStore'
import { useTheme } from '../lib/theme'
import { friendlyErrorMessage } from '../lib/errorUtils'

export default function CreateStoryScreen() {
  const theme = useTheme()
  const { loadStories } = useStoriesStore()
  const [mediaUri, setMediaUri] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your media library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as ImagePicker.MediaType[],
      allowsEditing: false,
      quality: 0.8,
    })
    if (!result.canceled) {
      const asset = result.assets[0]
      setMediaUri(asset.uri)
      setMediaType(asset.type === 'video' ? 'video' : 'image')
    }
  }

  const handlePost = async () => {
    if (!mediaUri) {
      Alert.alert('No media', 'Pick a photo or video first.')
      return
    }
    setUploading(true)
    try {
      const ext = mediaUri.split('.').pop()?.toLowerCase() ?? ''
      const mimeType = mediaType === 'video'
        ? (ext === 'mov' ? 'video/quicktime' : 'video/mp4')
        : (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg')
      const { data: url, error: uploadError } = await uploadStoryMedia(mediaUri, mimeType)
      if (uploadError || !url) throw uploadError ?? new Error('Upload failed')

      const { error: createError } = await createStory({
        mediaUrl: url,
        mediaType,
        caption: caption.trim() || undefined,
        durationSecs: mediaType === 'video' ? 10 : 5,
      })
      if (createError) throw createError
      await loadStories()
      router.back()
    } catch (err: unknown) {
      Alert.alert('Story failed', friendlyErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
          <Ionicons name="close" size={22} color="rgba(240,240,255,0.6)" />
        </TouchableOpacity>
        <Text style={s.title}>New Story</Text>
        <TouchableOpacity
          style={[s.postBtn, (!mediaUri || uploading) && s.postBtnDisabled]}
          onPress={handlePost}
          disabled={!mediaUri || uploading}>
          {uploading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.postBtnText}>Share</Text>}
        </TouchableOpacity>
      </View>

      {/* Preview */}
      {mediaUri ? (
        <View style={s.previewWrap}>
          <Image source={{ uri: mediaUri }} style={s.preview} resizeMode="cover" />
          <TouchableOpacity
            style={s.changeBtn}
            onPress={pickMedia}>
            <Ionicons name="camera-reverse-outline" size={18} color="#fff" />
            <Text style={s.changeBtnText}>Change</Text>
          </TouchableOpacity>
          {/* Caption input */}
          <View style={s.captionWrap}>
            <TextInput
              style={s.captionInput}
              placeholder="Add a caption..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={caption}
              onChangeText={setCaption}
              maxLength={150}
            />
          </View>
        </View>
      ) : (
        <TouchableOpacity style={s.pickArea} onPress={pickMedia}>
          <Ionicons name="image-outline" size={64} color="rgba(240,240,255,0.15)" />
          <Text style={s.pickTitle}>Add photo or video</Text>
          <Text style={s.pickSub}>Tap to pick from your library</Text>
          <View style={s.pickBtn}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.pickBtnText}>Choose media</Text>
          </View>
        </TouchableOpacity>
      )}
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
    minWidth: 68, alignItems: 'center',
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  pickArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingHorizontal: 40,
  },
  pickTitle: { fontSize: 18, fontWeight: '600', color: '#f0f0ff' },
  pickSub: { fontSize: 13, color: 'rgba(240,240,255,0.4)', textAlign: 'center' },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8,
    backgroundColor: '#a78bfa', borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  pickBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  previewWrap: { flex: 1, position: 'relative' },
  preview: { flex: 1, width: '100%' },
  videoPlaceholder: {
    backgroundColor: '#111', alignItems: 'center',
    justifyContent: 'center', gap: 12,
  },
  videoPlaceholderText: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  videoPlaceholderSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingHorizontal: 32 },
  changeBtn: {
    position: 'absolute', top: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  changeBtnText: { fontSize: 12, color: '#fff', fontWeight: '500' },
  captionWrap: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
  },
  captionInput: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#fff',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)',
  },
})
