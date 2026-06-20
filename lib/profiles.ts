/**
 * lib/profiles.ts
 * Profile helpers — updated to include follower/following counts and
 * follow/unfollow operations.
 *
 * Backwards-compatible: existing callers of getCurrentProfile, updateProfile,
 * getAllProfiles, getProfileStats, and setOnlineStatus continue to work.
 */
import { client } from './aws'
import { getCurrentUser } from 'aws-amplify/auth'
import { uploadFile } from './upload'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  bio: string | null
  department: string | null
  level: string | null
  interests: string[] | null
  avatar_url: string | null
  push_token: string | null
  role: 'student' | 'admin' | 'vendor'
  follower_count: number
  following_count: number
  is_online?: boolean
  is_verified?: boolean
  cover_url?: string | null
  badge_type?: string | null
  badge_color?: string | null
  current_streak?: number
  longest_streak?: number
  last_active_date?: string | null
}

export interface ProfileStats {
  posts: number
  friends: number
  followers: number
  following: number
  clubs: number
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

export async function getCurrentProfile(): Promise<Profile | null> {
  let user;
  try { user = await getCurrentUser(); } catch { return null; }

  const { data: profile, errors } = await client.models.Profile.get({ id: user.userId })

  if (errors || !profile) {
    console.log('Profile error:', errors)
    return null
  }
  return profile as unknown as Profile
}

export async function updateProfile(updates: {
  full_name?: string
  bio?: string
  department?: string
  level?: string
  interests?: string[]
  avatar_url?: string
  cover_url?: string | null
}) {
  let user;
  try { user = await getCurrentUser(); } catch { return { error: 'Not logged in' }; }

  const { data, errors } = await client.models.Profile.update({ id: user.userId, ...updates })

  return { error: errors?.[0] }
}

// ---------------------------------------------------------------------------
// Profiles list
// ---------------------------------------------------------------------------

export async function getAllProfiles() {
  let user;
  try { user = await getCurrentUser(); } catch {}

  const { data, errors } = await client.models.Profile.list({
    limit: 20
  })

  if (errors) return []
  return data?.filter(p => p.id !== user?.userId) ?? []
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  const { data, errors } = await client.models.Profile.get({ id: userId })

  if (errors || !data) return null
  return data as unknown as Profile
}

// ---------------------------------------------------------------------------
// Profile stats
// ---------------------------------------------------------------------------

export async function getProfileStats(): Promise<ProfileStats> {
  let user;
  try { user = await getCurrentUser(); } catch { return { posts: 0, friends: 0, followers: 0, following: 0, clubs: 0 } }

  // AWS AppSync Gen 2 client doesn't have a direct "count" query by default without custom resolvers.
  // We'll list IDs and count the array length for now. In production, this should use a custom resolver or GSI count.
  const [postsResult, connections1, connections2, followerRes, followingRes, clubsResult] =
    await Promise.all([
      client.models.Post.list({ filter: { author_id: { eq: user.userId } }, limit: 10000 }),
      client.models.Connection.list({ filter: { requester_id: { eq: user.userId }, status: { eq: 'accepted' } }, limit: 10000 }),
      client.models.Connection.list({ filter: { receiver_id: { eq: user.userId }, status: { eq: 'accepted' } }, limit: 10000 }),
      client.models.Follow.list({ filter: { following_id: { eq: user.userId } }, limit: 10000 }),
      client.models.Follow.list({ filter: { follower_id: { eq: user.userId } }, limit: 10000 }),
      client.models.ClubMember.list({ filter: { user_id: { eq: user.userId } }, limit: 10000 }),
    ])

  return {
    posts: postsResult.data?.length ?? 0,
    friends: (connections1.data?.length ?? 0) + (connections2.data?.length ?? 0),
    followers: followerRes.data?.length ?? 0,
    following: followingRes.data?.length ?? 0,
    clubs: clubsResult.data?.length ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Online status
// ---------------------------------------------------------------------------

export async function setOnlineStatus(isOnline: boolean) {
  let user;
  try { user = await getCurrentUser(); } catch { return; }

  await client.models.Profile.update({ id: user.userId, is_online: isOnline })
}

// ---------------------------------------------------------------------------
// Avatar upload
// ---------------------------------------------------------------------------

export async function uploadAvatar(uri: string): Promise<{
  data: string | null
  error: Error | null
}> {
  try {
    const user = await getCurrentUser();
    
    const cleanUri = uri.split('?')[0].split('#')[0]
    let ext = cleanUri.split('.').pop()?.toLowerCase() ?? 'jpg'
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      ext = 'jpg'
    }
    const path = `${user.userId}/${user.userId}.${ext}`
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

    const publicUrl = await uploadFile('avatars', path, uri, mimeType, true)

    // Persist the URL to the profile
    await client.models.Profile.update({ id: user.userId, avatar_url: publicUrl })

    return { data: publicUrl, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function uploadCover(uri: string): Promise<{
  data: string | null
  error: Error | null
}> {
  try {
    const user = await getCurrentUser()

    const cleanUri = uri.split('?')[0].split('#')[0]
    let ext = cleanUri.split('.').pop()?.toLowerCase() ?? 'jpg'
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      ext = 'jpg'
    }
    const path = `${user.userId}/cover-${Date.now()}.${ext}`
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

    const publicUrl = await uploadFile('avatars', path, uri, mimeType, true)

    // Persist the URL to the profile
    await client.models.Profile.update({ id: user.userId, cover_url: publicUrl })

    return { data: publicUrl, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// User posts (for public profile page)
// ---------------------------------------------------------------------------

export async function getUserPosts(userId: string, limit = 20) {
  const { data, errors } = await client.models.Post.list({
    filter: {
      author_id: { eq: userId },
      is_anonymous: { eq: false }
    },
    limit
  })

  if (errors) return []
  return data ?? []
}
