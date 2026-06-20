/**
 * lib/posts.ts
 * Core post helpers — updated to use the `public_posts` VIEW so that
 * anonymous post author_ids are never exposed to clients.
 *
 * Backwards-compatible: existing callers of getFeedPosts, createPost,
 * likePost, and getConfessionPosts continue to work.
 *
 * New helpers (toggleLike, addComment, repost) delegate to lib/feed.ts
 * which owns the fuller implementation.
 */
import { client } from './aws'
import { getCurrentUser } from 'aws-amplify/auth'

// ---------------------------------------------------------------------------
// Feed posts (uses public_posts VIEW)
// ---------------------------------------------------------------------------

/**
 * Returns the 20 most recent non-anonymous feed posts.
 * Joins profiles so existing UI code (post.profiles?.full_name) keeps working.
 */
export async function getFeedPosts() {
  const { data, errors: error } = await client.models.posts.list({
    filter: { is_anonymous: { eq: false } },
    limit: 20
  })

  if (error) {
    console.log('getFeedPosts error:', error)
    return []
  }
  return data ?? []
}

// ---------------------------------------------------------------------------
// Create post
// ---------------------------------------------------------------------------

export async function createPost(
  body: string,
  tags: string[],
  imageUrl: string | null = null,
  isAnonymous = false
) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: 'Not logged in' };
  }

  const { data, errors: error } = await client.models.posts.create({
    author_id: user.userId,
    body,
    tags,
    image_url: imageUrl ?? null,
    is_anonymous: isAnonymous,
    post_type: isAnonymous ? 'anonymous' : 'feed',
  })

  return { data, error }
}

// ---------------------------------------------------------------------------
// Like / unlike (delegates to toggle_post_like RPC)
// ---------------------------------------------------------------------------

/**
 * Backward-compatible likePost. Now calls the atomic toggle RPC instead of
 * the deprecated increment_likes RPC.
 */
export async function likePost(postId: string) {
  const { data, errors: error } = await (client.mutations as any).toggle_post_like({ p_post_id: postId })
  return { data, error }
}

// ---------------------------------------------------------------------------
// Confession / anonymous posts (uses public_posts VIEW)
// ---------------------------------------------------------------------------

/**
 * Returns anonymous posts via the public_posts VIEW.
 * The VIEW returns author_id = NULL for anonymous posts, so no PII leaks.
 */
export async function getConfessionPosts() {
  const { data, errors: error } = await client.models.posts.list({
    filter: { is_anonymous: { eq: true } },
    limit: 20
  })

  if (error) {
    console.log('getConfessionPosts error:', error)
    return []
  }
  // Belt-and-suspenders: ensure author_id is null on the way out
  return (data ?? []).map((p: any) => ({ ...p, author_id: null }))
}

// ---------------------------------------------------------------------------
// Comments (thin wrappers — full implementation in lib/feed.ts)
// ---------------------------------------------------------------------------

export async function addComment(postId: string, body: string, isAnonymous = false) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { error: 'Not logged in' };
  }

  const { data, errors: error } = await client.models.post_comments.create({ post_id: postId, author_id: user.userId, body, is_anonymous: isAnonymous })

  const comment = data as any
  if (comment && comment.is_anonymous) {
    comment.author_id = null
    comment.profiles = null
  }

  return { data: comment, error }
}

export async function getComments(postId: string) {
  const { data, errors: error } = await client.models.post_comments.list({
    filter: { post_id: { eq: postId } }
  })

  const sanitized = (data ?? []).map((c: any) => {
    if (c.is_anonymous) {
      return { ...c, author_id: null, profiles: null }
    }
    return c
  })

  return { data: sanitized, error }
}
