import { Platform } from 'react-native'

const S3_BUCKET_URL = 'https://faf-infra-prod-v2-appstoragebucket-prasmiamuew2.s3.amazonaws.com'

/**
 * Upload a local file URI directly to AWS S3 Storage.
 * Returns the public URL on success.
 * @param bucket  - S3 virtual bucket name (folder prefix)
 * @param path    - Object path inside the bucket (e.g. "userId/timestamp.jpg")
 * @param uri     - Local file URI from expo-image-picker or expo-document-picker
 * @param mimeType - MIME type (e.g. "image/jpeg" or "video/mp4")
 * @param upsert  - Unused in direct S3 upload
 */
export async function uploadFile(
  bucket: string,
  path: string,
  uri: string,
  mimeType: string,
  upsert = false,
): Promise<string> {
  const s3Key = `${bucket}/${path}`
  const s3Url = `${S3_BUCKET_URL}/${s3Key}`

  console.log(`[S3 Upload] Uploading ${uri} to ${s3Url} (${mimeType})`)

  try {
    const resBlob = await fetch(uri)
    const blob = await resBlob.blob()

    const uploadRes = await fetch(s3Url, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      body: blob,
    })

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text().catch(() => '')
      throw new Error(`S3 upload failed with status ${uploadRes.status}: ${errorText}`)
    }
  } catch (err: any) {
    throw new Error(`Upload to S3 failed: ${err.message || String(err)}`)
  }

  return s3Url
}

