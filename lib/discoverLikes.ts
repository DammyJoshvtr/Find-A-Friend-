import { supabase } from './supabase'
import type { FollowProfile } from './follows'

// ─── Record a like (swipe right) ─────────────────────────────────────────────

export async function likeUser(likedId: string): Promise<{ error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    if (user.id === likedId) return { error: null }

    const { error } = await supabase
      .from('discover_likes')
      .insert({ liker_id: user.id, liked_id: likedId })

    if (error && error.code !== '23505') throw error  // ignore duplicate
    return { error: null }
  } catch (err) {
    return { error: err as Error }
  }
}

// ─── People who liked you ─────────────────────────────────────────────────────

export async function getLikesReceived(): Promise<{
  data: FollowProfile[] | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Fetch who we liked first to filter out mutual connections
    const { data: iLiked } = await supabase
      .from('discover_likes')
      .select('liked_id')
      .eq('liker_id', user.id)
    const iLikedIds = (iLiked ?? []).map((r: any) => r.liked_id)

    const { data, error } = await supabase
      .from('discover_likes')
      .select(`
        liker_id,
        created_at,
        profiles!discover_likes_liker_id_fkey(
          id, full_name, department, level, avatar_url,
          follower_count, following_count, interests
        )
      `)
      .eq('liked_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const profiles = (data ?? [])
      .filter((r: any) => !iLikedIds.includes(r.liker_id))
      .map((r: any) => r.profiles)
      .filter(Boolean) as FollowProfile[]

    return { data: profiles, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ─── Mutual likes (you both liked each other) → "Matches" ────────────────────

export async function getMutualLikes(): Promise<{
  data: FollowProfile[] | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // IDs I liked
    const { data: iLiked } = await supabase
      .from('discover_likes')
      .select('liked_id')
      .eq('liker_id', user.id)

    const iLikedIds = (iLiked ?? []).map((r: any) => r.liked_id)
    if (iLikedIds.length === 0) return { data: [], error: null }

    // From those, who also liked me back?
    const { data, error } = await supabase
      .from('discover_likes')
      .select(`
        liker_id,
        profiles!discover_likes_liker_id_fkey(
          id, full_name, department, level, avatar_url,
          follower_count, following_count, interests
        )
      `)
      .eq('liked_id', user.id)
      .in('liker_id', iLikedIds)

    if (error) throw error

    const profiles = (data ?? [])
      .map((r: any) => r.profiles)
      .filter(Boolean) as FollowProfile[]

    return { data: profiles, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ─── Counts for badge/header ──────────────────────────────────────────────────

export async function getLikesCounts(): Promise<{
  received: number
  mutual: number
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { received: 0, mutual: 0 }

    const [likesRes, mutualRes] = await Promise.all([
      getLikesReceived(),
      getMutualLikes(),
    ])

    return {
      received: likesRes.data?.length ?? 0,
      mutual:   mutualRes.data?.length ?? 0,
    }
  } catch {
    return { received: 0, mutual: 0 }
  }
}

// ─── Connection / Request Status Engines ──────────────────────────────────────

export type ConnectionStatus = 'none' | 'requested_sent' | 'requested_received' | 'connected';

export async function unlikeUser(likedId: string): Promise<{ error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('discover_likes')
      .delete()
      .eq('liker_id', user.id)
      .eq('liked_id', likedId)

    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err as Error }
  }
}

export async function getConnectionStatus(targetUserId: string): Promise<ConnectionStatus> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'none'
    if (user.id === targetUserId) return 'none'

    // 1. Did I follow them?
    const { data: iFollow } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle()

    // 2. Did they follow me?
    const { data: theyFollow } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', targetUserId)
      .eq('following_id', user.id)
      .maybeSingle()

    if (iFollow && theyFollow) {
      return 'connected'
    } else if (iFollow) {
      return 'requested_sent'
    } else if (theyFollow) {
      return 'requested_received'
    }
    return 'none'
  } catch (err) {
    console.warn('[getConnectionStatus] error:', err)
    return 'none'
  }
}

export async function getConnectionStatusesBulk(targetUserIds: string[]): Promise<Record<string, ConnectionStatus>> {
  const result: Record<string, ConnectionStatus> = {}
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || targetUserIds.length === 0) return result

    // 1. Get all users from the list that I follow
    const { data: followingRows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .in('following_id', targetUserIds)

    const followingSet = new Set((followingRows ?? []).map(r => r.following_id))

    // 2. Get all users from the list that follow me
    const { data: followerRows } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', user.id)
      .in('follower_id', targetUserIds)

    const followerSet = new Set((followerRows ?? []).map(r => r.follower_id))

    // 3. Compute status for each target user
    for (const id of targetUserIds) {
      const iFollow = followingSet.has(id)
      const theyFollow = followerSet.has(id)

      if (iFollow && theyFollow) {
        result[id] = 'connected'
      } else if (iFollow) {
        result[id] = 'requested_sent'
      } else if (theyFollow) {
        result[id] = 'requested_received'
      } else {
        result[id] = 'none'
      }
    }
  } catch (err) {
    console.warn('[getConnectionStatusesBulk] error:', err)
  }
  return result
}
