import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import { Platform } from 'react-native'

export type AttachmentType = 'image' | 'video'

export interface Attachment {
  _type: AttachmentType
  url: string
  name?: string
  mimeType?: string
  width?: number
  height?: number
}

export function parseAttachment(body: string): Attachment | null {
  try {
    const parsed = JSON.parse(body)
    if (parsed._type && parsed.url) return parsed as Attachment
    return null
  } catch {
    return null
  }
}

import { uploadFile } from './upload'

async function uploadToStorage(uri: string, path: string, mimeType: string): Promise<string> {
  return await uploadFile('chat-files', path, uri, mimeType)
}

function storagePath(convId: string, filename: string): string {
  return `${convId}/${Date.now()}_${filename}`
}

// ─── Pick photo or video from gallery ────────────────────────────────────────
export async function pickMedia(convId: string): Promise<Attachment | null> {
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
  const url = await uploadToStorage(asset.uri, storagePath(convId, filename), mime)
  const att: Attachment = { _type: isVideo ? 'video' : 'image', url, name: filename, mimeType: mime }
  if (!isVideo && asset.width && asset.height) { att.width = asset.width; att.height = asset.height }
  return att
}

// ─── Take photo with camera ───────────────────────────────────────────────────
export async function takePhoto(convId: string): Promise<Attachment | null> {
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
  const url = await uploadToStorage(asset.uri, storagePath(convId, `photo_${Date.now()}.jpg`), mime)
  return { _type: 'image', url, mimeType: mime, width: asset.width, height: asset.height }
}

// ─── Record video with camera ─────────────────────────────────────────────────
export async function recordVideo(convId: string): Promise<Attachment | null> {
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
  const url = await uploadToStorage(asset.uri, storagePath(convId, `video_${Date.now()}.mp4`), mime)
  return { _type: 'video', url, name: 'Video', mimeType: mime }
}
