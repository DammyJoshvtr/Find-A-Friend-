import { client } from './aws'
import { getCurrentUser } from 'aws-amplify/auth'
import type { FollowProfile } from './follows'

// ─── Record a like (swipe right) ─────────────────────────────────────────────

export async function likeUser(likedId: string): Promise<{ error: Error | null }> {
  try {
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }
    if (user.id === likedId) return { error: null }

    const { errors: error } = await client.models.DiscoverLikes.create({ liker_id: user.id, liked_id: likedId })

    if (error) throw error[0]  // ignore duplicate
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
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    // Fetch who we liked first to filter out mutual connections
    const { data: iLiked } = await client.models.DiscoverLikes.list({
      filter: { liker_id: { eq: user.id } }
    })
    const iLikedIds = (iLiked ?? []).map((r: any) => r.liked_id)

    const { data, errors: error } = await client.models.DiscoverLikes.list({
      filter: { liked_id: { eq: user.id } },
      selectionSet: ['liker_id', 'created_at', 'profiles.*']
    })

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
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    // IDs I liked
    const { data: iLiked } = await client.models.DiscoverLikes.list({
      filter: { liker_id: { eq: user.id } }
    })

    const iLikedIds = (iLiked ?? []).map((r: any) => r.liked_id)
    if (iLikedIds.length === 0) return { data: [], error: null }

    // From those, who also liked me back?
    const { data, errors: error } = await client.models.DiscoverLikes.list({
      filter: { liked_id: { eq: user.id } },
      selectionSet: ['liker_id', 'profiles.*']
    })

    if (error) throw error

    const profiles = (data ?? [])
      .filter((r: any) => iLikedIds.includes(r.liker_id))
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
    const authUser = await getCurrentUser()
    if (!authUser) return { received: 0, mutual: 0 }

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
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    const { data: records } = await client.models.DiscoverLikes.list({
      filter: { liker_id: { eq: user.id }, liked_id: { eq: likedId } }
    })

    if (records && records.length > 0) {
      const { errors: error } = await client.models.DiscoverLikes.delete({ id: records[0].id })
      if (error) throw error[0]
    }

    return { error: null }
  } catch (err) {
    return { error: err as Error }
  }
}

export async function getConnectionStatus(targetUserId: string): Promise<ConnectionStatus> {
  try {
    const authUser = await getCurrentUser()
    if (!authUser) return 'none'
    const user = { id: authUser.userId }
    if (user.id === targetUserId) return 'none'

    // 1. Did I follow them?
    const { data: iFollowRes } = await client.models.Follows.list({
      filter: { follower_id: { eq: user.id }, following_id: { eq: targetUserId } }
    })
    const iFollow = iFollowRes && iFollowRes.length > 0 ? iFollowRes[0] : null

    // 2. Did they follow me?
    const { data: theyFollowRes } = await client.models.Follows.list({
      filter: { follower_id: { eq: targetUserId }, following_id: { eq: user.id } }
    })
    const theyFollow = theyFollowRes && theyFollowRes.length > 0 ? theyFollowRes[0] : null

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
    const authUser = await getCurrentUser()
    if (!authUser || targetUserIds.length === 0) return result
    const user = { id: authUser.userId }

    // 1. Get all users from the list that I follow
    const { data: followingRows } = await client.models.Follows.list({
      filter: { follower_id: { eq: user.id } }
    })

    const followingSet = new Set((followingRows ?? []).filter((r: any) => targetUserIds.includes(r.following_id)).map((r: any) => r.following_id))

    // 2. Get all users from the list that follow me
    const { data: followerRows } = await client.models.Follows.list({
      filter: { following_id: { eq: user.id } }
    })

    const followerSet = new Set((followerRows ?? []).filter((r: any) => targetUserIds.includes(r.follower_id)).map((r: any) => r.follower_id))

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
