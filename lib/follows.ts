/**
 * lib/follows.ts
 * Unidirectional follow system (Twitter-style).
 * Separate from the bidirectional `connections` table which is kept for DM access.
 *
 * Triggers on the `follows` table maintain follower_count / following_count
 * on profiles automatically — no manual updates needed here.
 */
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FollowProfile {
  id: string
  full_name: string | null
  department: string | null
  level: string | null
  avatar_url: string | null
  follower_count: number
  following_count: number
  interests?: string[] | null
}

export type FollowStatus = 'following' | 'not_following'

// ---------------------------------------------------------------------------
// Follow / Unfollow
// ---------------------------------------------------------------------------

export async function followUser(targetUserId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    if (user.id === targetUserId) throw new Error('Cannot follow yourself')

    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id: targetUserId })

    // Ignore duplicate follows gracefully
    if (error && error.code !== '23505') throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function unfollowUser(targetUserId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Status check
// ---------------------------------------------------------------------------

/**
 * Returns whether the current user follows `targetUserId`.
 */
export async function getFollowStatus(targetUserId: string): Promise<{
  data: FollowStatus | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: 'not_following', error: null }

    const { data, error } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle()

    if (error) throw error
    return { data: data ? 'following' : 'not_following', error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Bulk follow-status check for a list of user IDs.
 * Returns a Set of IDs that the current user follows.
 */
export async function getFollowStatusBulk(
  targetUserIds: string[]
): Promise<Set<string>> {
  if (!targetUserIds.length) return new Set()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()

  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .in('following_id', targetUserIds)

  return new Set((data ?? []).map((r: { following_id: string }) => r.following_id))
}

// ---------------------------------------------------------------------------
// Followers / Following lists
// ---------------------------------------------------------------------------

export async function getFollowers(userId: string): Promise<{
  data: FollowProfile[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('profiles!follows_follower_id_fkey(id, full_name, department, level, avatar_url, follower_count, following_count)')
      .eq('following_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    const profiles = (data ?? [])
      .map((r: any) => r.profiles)
      .filter(Boolean) as FollowProfile[]
    return { data: profiles, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getFollowing(userId: string): Promise<{
  data: FollowProfile[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('profiles!follows_following_id_fkey(id, full_name, department, level, avatar_url, follower_count, following_count)')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    const profiles = (data ?? [])
      .map((r: any) => r.profiles)
      .filter(Boolean) as FollowProfile[]
    return { data: profiles, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Suggested users
// ---------------------------------------------------------------------------

/**
 * Returns users suggested for the current user to follow.
 * Strategy:
 * 1. Exclude users already followed and the current user.
 * 2. Score by shared interests (via profiles.interests array overlap).
 * 3. Return top 20.
 */
export async function getSuggestedUsers(): Promise<{
  data: FollowProfile[] | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get IDs the current user already follows
    const { data: followingRows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const alreadyFollowingIds: string[] = (followingRows ?? []).map(
      (r: { following_id: string }) => r.following_id
    )
    // Fetch candidates — always exclude at least the current user
    const excludeIds = [user.id, ...alreadyFollowingIds]

    let candidateQuery = supabase
      .from('profiles')
      .select('id, full_name, department, level, avatar_url, follower_count, following_count, interests')
      .limit(50)
      .neq('id', user.id)  // always exclude self

    // Exclude already-followed users one-by-one (safer than .not+in for small lists)
    for (const id of alreadyFollowingIds) {
      candidateQuery = candidateQuery.neq('id', id)
    }

    const { data, error } = await candidateQuery
    if (error) {
      console.warn('[getSuggestedUsers] query error:', error.message, error.code, error.details)
      throw error
    }

    console.log('[getSuggestedUsers] raw results:', data?.length, 'users found')
    console.log('[getSuggestedUsers] current user:', user.id)
    console.log('[getSuggestedUsers] already following:', alreadyFollowingIds.length)

    const sorted = (data ?? []).sort(
      (a: any, b: any) => (b.follower_count ?? 0) - (a.follower_count ?? 0)
    )

    return { data: sorted.slice(0, 20) as FollowProfile[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Public profile
// ---------------------------------------------------------------------------

export async function getUserProfile(userId: string): Promise<{
  data: FollowProfile | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, department, level, avatar_url, follower_count, following_count, interests')
      .eq('id', userId)
      .single()

    if (error) throw error
    return { data: data as FollowProfile, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
