/**
 * lib/follows.ts
 * Unidirectional follow system (Twitter-style).
 * Separate from the bidirectional `connections` table which is kept for DM access.
 *
 * Triggers on the `follows` table maintain follower_count / following_count
 * on profiles automatically — no manual updates needed here.
 */
import { client } from "./aws";
import { getCurrentUser } from 'aws-amplify/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FollowProfile {
  id: string;
  full_name: string | null;
  department: string | null;
  level: string | null;
  avatar_url: string | null;
  follower_count: number;
  following_count: number;
  interests?: string[] | null;
  role?: string | null;
  badge_type?: string | null;
  badge_color?: string | null;
}

export type FollowStatus = "following" | "not_following";

// ---------------------------------------------------------------------------
// Follow / Unfollow
// ---------------------------------------------------------------------------

export async function followUser(targetUserId: string): Promise<{
  data: null;
  error: Error | null;
}> {
  try {
    let user;
    try { user = await getCurrentUser(); } catch { throw new Error("Not authenticated"); }
    if (user.userId === targetUserId) throw new Error("Cannot follow yourself");

    const { errors } = await client.models.Follow.create({ follower_id: user.userId, following_id: targetUserId });

    // Ignore duplicate follows gracefully
    if (errors && errors[0]?.message?.includes('ConditionalCheckFailedException')) return { data: null, error: null };
    if (errors) throw new Error(errors[0].message);
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function unfollowUser(targetUserId: string): Promise<{
  data: null;
  error: Error | null;
}> {
  try {
    let user;
    try { user = await getCurrentUser(); } catch { throw new Error("Not authenticated"); }

    const { data } = await client.models.Follow.list({
      filter: {
        follower_id: { eq: user.userId },
        following_id: { eq: targetUserId }
      }
    });

    if (data && data.length > 0) {
      const { errors } = await client.models.Follow.delete({ id: data[0].id });
      if (errors) throw new Error(errors[0].message);
    }
    
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// ---------------------------------------------------------------------------
// Status check
// ---------------------------------------------------------------------------

/**
 * Returns whether the current user follows `targetUserId`.
 */
export async function getFollowStatus(targetUserId: string): Promise<{
  data: FollowStatus | null;
  error: Error | null;
}> {
  try {
    let user;
    try { user = await getCurrentUser(); } catch { return { data: "not_following", error: null }; }

    const { data, errors } = await client.models.Follow.list({
      filter: {
        follower_id: { eq: user.userId },
        following_id: { eq: targetUserId }
      }
    });

    if (errors) throw new Error(errors[0].message);
    return { data: (data && data.length > 0) ? "following" : "not_following", error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Bulk follow-status check for a list of user IDs.
 * Returns a Set of IDs that the current user follows.
 */
export async function getFollowStatusBulk(
  targetUserIds: string[],
): Promise<Set<string>> {
  if (!targetUserIds.length) return new Set();

  let user;
  try { user = await getCurrentUser(); } catch { return new Set(); }

  // Simple fetch all and filter
  const { data } = await client.models.Follow.list({
    filter: {
      follower_id: { eq: user.userId }
    }
  });

  return new Set(
    (data ?? [])
      .filter(f => targetUserIds.includes(f.following_id))
      .map((r: any) => r.following_id),
  );
}

// ---------------------------------------------------------------------------
// Followers / Following lists
// ---------------------------------------------------------------------------

export async function getFollowers(userId: string): Promise<{
  data: FollowProfile[] | null;
  error: Error | null;
}> {
  try {
    const { data, errors } = await client.models.Follow.list({
      filter: { following_id: { eq: userId } }
    });

    if (errors) throw new Error(errors[0].message);
    // Since relational fetches depend on the schema definition, assuming it hydrates .profiles or we map
    const profiles = (data ?? [])
      .map((r: any) => r.profiles)
      .filter(Boolean) as FollowProfile[];
    return { data: profiles, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getFollowing(userId: string): Promise<{
  data: FollowProfile[] | null;
  error: Error | null;
}> {
  try {
    const { data, errors } = await client.models.Follow.list({
      filter: { follower_id: { eq: userId } }
    });

    if (errors) throw new Error(errors[0].message);
    const profiles = (data ?? [])
      .map((r: any) => r.profiles)
      .filter(Boolean) as FollowProfile[];
    return { data: profiles, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
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
  data: FollowProfile[] | null;
  error: Error | null;
}> {
  try {
    let user;
    try { user = await getCurrentUser(); } catch { throw new Error("Not authenticated"); }

    // Get IDs the current user already follows
    const { data: followingRows } = await client.models.Follow.list({
      filter: { follower_id: { eq: user.userId } }
    });

    const alreadyFollowingIds: string[] = (followingRows ?? []).map(
      (r: any) => r.following_id,
    );
    // Fetch candidates — always exclude at least the current user
    const excludeIds = [user.userId, ...alreadyFollowingIds];

    // Due to list limits and filter complexities, fetch a batch of profiles
    const { data, errors } = await client.models.Profile.list({
      limit: 500
    });
    
    if (errors) {
      throw new Error(errors[0].message);
    }
    
    const filteredData = (data ?? []).filter((p: any) => 
      !excludeIds.includes(p.id) && p.full_name
    );

    console.log(
      "[getSuggestedUsers] raw results:",
      filteredData?.length,
      "users found",
    );
    console.log("[getSuggestedUsers] current user:", user.id);
    console.log(
      "[getSuggestedUsers] already following:",
      alreadyFollowingIds.length,
    );

    const sorted = filteredData.sort(
      (a: any, b: any) => (b.follower_count ?? 0) - (a.follower_count ?? 0),
    );

    // Return all users (no artificial 20-user cap) so everyone is visible on discover
    return { data: sorted as FollowProfile[], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// ---------------------------------------------------------------------------
// Public profile
// ---------------------------------------------------------------------------

export async function getUserProfile(userId: string): Promise<{
  data: FollowProfile | null;
  error: Error | null;
}> {
  try {
    const { data, errors } = await client.models.Profile.get({ id: userId });

    if (errors) throw new Error(errors[0].message);
    return { data: data as unknown as FollowProfile, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// =======================================
// Get the top 10 folowers in the database
// =======================================

export const getMostFollowedUsers = async (): Promise<{
  data: FollowProfile[] | null;
  error: Error | null;
}> => {
  try {
    // In AppSync you can't easily order dynamically on the client without a GSI or custom resolver.
    // We will list and sort client-side for now to not break the UI.
    const { data, errors } = await client.models.Profile.list({ limit: 100 });
    
    if (errors) throw new Error(errors[0].message);

    const sorted = (data ?? []).sort((a: any, b: any) => (b.follower_count ?? 0) - (a.follower_count ?? 0)).slice(0, 10);
    console.log("Top 10 Influencers:", sorted);

    return { data: sorted as unknown as FollowProfile[], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
};
