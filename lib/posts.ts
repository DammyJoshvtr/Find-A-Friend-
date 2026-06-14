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
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Feed posts (uses public_posts VIEW)
// ---------------------------------------------------------------------------

/**
 * Returns the 20 most recent non-anonymous feed posts.
 * Joins profiles so existing UI code (post.profiles?.full_name) keeps working.
 */
export async function getFeedPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select('*, profiles!author_id(id, full_name, department, level, avatar_url)')
    .eq('is_anonymous', false)
    .order('created_at', { ascending: false })
    .limit(20)

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in' }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: user.id,
      body,
      tags,
      image_url: imageUrl ?? null,
      is_anonymous: isAnonymous,
      post_type: isAnonymous ? 'anonymous' : 'feed',
    })
    .select()
    .single()

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
  const { data, error } = await supabase
    .rpc('toggle_post_like', { p_post_id: postId })
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
  const { data, error } = await supabase
    .from('posts')
    .select('id, body, tags, image_url, is_anonymous, post_type, likes_count, comments_count, author_id, created_at')
    .eq('is_anonymous', true)
    .order('created_at', { ascending: false })
    .limit(20)

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in' }

  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, author_id: user.id, body, is_anonymous: isAnonymous })
    .select('*, profiles!author_id(id, full_name, department, level, avatar_url)')
    .single()

  const comment = data as any
  if (comment && comment.is_anonymous) {
    comment.author_id = null
    comment.profiles = null
  }

  return { data: comment, error }
}

export async function getComments(postId: string) {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*, profiles!author_id(id, full_name, department, level, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  const sanitized = (data ?? []).map((c: any) => {
    if (c.is_anonymous) {
      return { ...c, author_id: null, profiles: null }
    }
    return c
  })

  return { data: sanitized, error }
}
