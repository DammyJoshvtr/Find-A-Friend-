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
