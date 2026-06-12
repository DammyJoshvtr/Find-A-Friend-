import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'
import { Platform } from 'react-native'
import { supabase } from './supabase'

export type FeedMediaType = 'image' | 'video'

export interface FeedMedia {
  url: string
  type: FeedMediaType
}

async function uploadToStorage(uri: string, path: string, mimeType: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri)
    const blob = await res.blob()
    const { error } = await supabase.storage
      .from('posts-media')
      .upload(path, blob, { contentType: mimeType, upsert: false })
    if (error) throw new Error(error.message)
  } else {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
    const { error } = await supabase.storage
      .from('posts-media')
      .upload(path, decode(base64), { contentType: mimeType, upsert: false })
    if (error) throw new Error(error.message)
  }
  const { data } = supabase.storage.from('posts-media').getPublicUrl(path)
  return data.publicUrl
}

function storagePath(filename: string): string {
  return `comments/${Date.now()}_${filename}`
}

// ─── Pick media from gallery ────────────────────────────────────────
export async function pickCommentMedia(): Promise<FeedMedia | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') throw new Error('Gallery permission denied')

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 0.8,
    allowsEditing: false,
    videoMaxDuration: 120,
  })
  if (result.canceled) return null

  const asset = result.assets[0]
  const isVideo = asset.type === 'video'
  const ext = isVideo ? 'mp4' : 'jpg'
  const filename = asset.fileName ?? `${isVideo ? 'video' : 'photo'}_${Date.now()}.${ext}`
  const mime = asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg')
  const url = await uploadToStorage(asset.uri, storagePath(filename), mime)
  
  return { url, type: isVideo ? 'video' : 'image' }
}

// ─── Take photo with camera ───────────────────────────────────────────────────
export async function takeCommentPhoto(): Promise<FeedMedia | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== 'granted') throw new Error('Camera permission denied')

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: false,
  })
  if (result.canceled) return null

  const asset = result.assets[0]
  const mime = asset.mimeType ?? 'image/jpeg'
  const url = await uploadToStorage(asset.uri, storagePath(`photo_${Date.now()}.jpg`), mime)
  return { url, type: 'image' }
}

// ─── Record video with camera ─────────────────────────────────────────────────
export async function recordCommentVideo(): Promise<FeedMedia | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== 'granted') throw new Error('Camera permission denied')

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    videoMaxDuration: 60,
    allowsEditing: false,
  })
  if (result.canceled) return null

  const asset = result.assets[0]
  const mime = asset.mimeType ?? 'video/mp4'
  const url = await uploadToStorage(asset.uri, storagePath(`video_${Date.now()}.mp4`), mime)
  return { url, type: 'video' }
}
