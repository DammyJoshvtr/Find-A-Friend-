/**
 * lib/upload.ts
 * Shared helper for uploading local file URIs to Supabase Storage.
 *
 * Uses FormData with a plain object { uri, name, type } so that React Native
 * can read the local file:// URI natively — bypassing the fetch(uri)+blob()
 * approach which throws "Network request failed" on Android.
 */
import { Platform } from 'react-native'
import { supabase } from './supabase'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!

/**
 * Upload a local file URI to a Supabase Storage bucket.
 * Returns the public URL on success.
 * @param bucket  - Storage bucket name
 * @param path    - Object path inside the bucket (e.g. "userId/timestamp.jpg")
 * @param uri     - Local file URI from expo-image-picker or expo-document-picker
 * @param mimeType - MIME type (e.g. "image/jpeg")
 * @param upsert  - Whether to overwrite an existing object at the same path
 */
export async function uploadFile(
  bucket: string,
  path: string,
  uri: string,
  mimeType: string,
  upsert = false,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const ext = mimeType.split('/')[1]?.split(';')[0] ?? uri.split('.').pop() ?? 'bin'

  if (Platform.OS === 'web') {
    const resBlob = await fetch(uri)
    const blob = await resBlob.blob()

    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType: mimeType,
      upsert,
    })

    if (error) {
      const msg = (error as any)?.message ?? String(error)
      throw new Error(`Upload failed: ${msg}`)
    }
  } else {
    // Uses FormData to bypass fetch() Network request failed issues on RN Android
    const formData = new FormData()
    formData.append('file', {
      uri,
      name: path.split('/').pop() || 'upload',
      type: mimeType,
    } as any)

    const { error } = await supabase.storage.from(bucket).upload(path, formData, {
      upsert,
    })

    if (error) {
      const msg = (error as any)?.message ?? String(error)
      throw new Error(`Upload failed: ${msg}`)
    }
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
