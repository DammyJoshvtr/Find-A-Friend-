/**
 * lib/errorUtils.ts
 * Shared utility for extracting clean, user-friendly error messages
 * from Supabase PostgrestError, StorageError, or generic JS Error objects.
 */

/**
 * Extracts a concise error message from any thrown value.
 * Supabase errors can be PostgrestError objects (with message, details, hint, code)
 * or StorageError objects, or nested JSON strings. This normalises them all.
 */
export function extractErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback

  // Standard JS Error
  if (err instanceof Error) {
    return cleanMessage(err.message) || fallback
  }

  // Supabase PostgrestError / StorageError (plain objects with a message field)
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string' && e.message.trim()) {
      return cleanMessage(e.message) || fallback
    }
    // Try to parse a nested JSON string
    if (typeof e.error === 'string') return cleanMessage(e.error) || fallback
  }

  // String error
  if (typeof err === 'string') return cleanMessage(err) || fallback

  return fallback
}

/**
 * Strips lengthy technical JSON blobs from error messages, returning
 * only the first human-readable sentence or a short description.
 */
function cleanMessage(raw: string): string {
  if (!raw) return ''

  // If the entire message is a JSON string, try to parse it
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed?.message === 'string') return parsed.message
      if (typeof parsed?.error === 'string') return parsed.error
      if (typeof parsed?.msg === 'string') return parsed.msg
    } catch {
      // Not valid JSON, use as-is
    }
  }

  // Strip embedded JSON at end of message (e.g. "Upload failed: {"statusCode":...}")
  const jsonStartIdx = trimmed.indexOf(': {')
  if (jsonStartIdx !== -1) {
    const prefix = trimmed.slice(0, jsonStartIdx)
    const jsonPart = trimmed.slice(jsonStartIdx + 2)
    try {
      const parsed = JSON.parse(jsonPart)
      const innerMsg = parsed?.message || parsed?.error || parsed?.msg
      if (typeof innerMsg === 'string') {
        return `${prefix}: ${innerMsg}`
      }
    } catch {
      // Not valid JSON suffix
    }
    // Return only the prefix for very long messages
    if (prefix.length > 0 && trimmed.length > 200) return prefix
  }

  // Truncate excessively long messages to first 200 chars
  if (trimmed.length > 300) {
    return trimmed.slice(0, 200) + '…'
  }

  return trimmed
}

/**
 * Maps known Supabase error codes / messages to friendly user-facing copy.
 */
export function friendlyErrorMessage(err: unknown): string {
  const raw = extractErrorMessage(err, '')
  const lower = raw.toLowerCase()

  if (!raw) return 'Something went wrong. Please try again.'

  // Auth errors
  if (lower.includes('not authenticated') || lower.includes('jwt expired') || lower.includes('invalid jwt')) {
    return 'Your session has expired. Please log out and log back in.'
  }

  // Storage / upload errors
  if (lower.includes('exceeded the maximum allowed size')) {
    return 'File is too large. Please choose a smaller file.'
  }
  if (lower.includes('mime type') || lower.includes('content type')) {
    return 'Unsupported file type. Please choose a JPEG, PNG, or WebP image.'
  }
  if (lower.includes('new row violates row-level security') || lower.includes('violates row-level security')) {
    return 'You don\'t have permission to perform this action.'
  }
  if (lower.includes('duplicate key') || lower.includes('already exists')) {
    return 'This already exists. Please try a different entry.'
  }
  if (lower.includes('network request failed') || lower.includes('fetch failed')) {
    return 'Network error. Please check your connection and try again.'
  }
  if (lower.includes('upload to') && lower.includes('failed')) {
    return 'File upload failed. Please check your connection and try again.'
  }

  // Return the cleaned message (already concise)
  return raw || 'Something went wrong. Please try again.'
}
