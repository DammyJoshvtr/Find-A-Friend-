/**
 * lib/feed.ts
 * Social feed helpers: posts, likes, comments, reposts, hashtags, trending.
 *
 * NOTE: Feed queries filter out anonymous posts (is_anonymous = false) at the
 * query level. Anonymous posts are only fetched through the anonymous board
 * screens which use dedicated queries.
 */
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeedAuthor {
  id: string
  full_name: string | null
  department: string | null
  level: string | null
  avatar_url: string | null
  role?: string | null
  badge_type?: string | null
  badge_color?: string | null
}

export interface FeedPost {
  id: string
  body: string
  tags: string[] | null
  image_url: string | null
  is_anonymous: boolean
  post_type: 'feed' | 'anonymous' | 'club' | 'academic'
  club_id: string | null
  study_group_id: string | null
  repost_of: string | null
  repost_count: number
  likes_count: number
  comments_count: number
  author_id: string | null  // null when is_anonymous = true
  created_at: string
  profiles?: FeedAuthor | null
  clubs?: { id: string; name: string } | null
  // Client-side derived fields
  is_liked?: boolean
  is_bookmarked?: boolean
  // Reposted original post (populated when repost_of != null)
  original_post?: FeedPost | null
}

export interface PostComment {
  id: string
  post_id: string
  parent_id?: string | null
  author_id: string
  body: string
  media_url?: string | null
  media_type?: string | null
  is_anonymous: boolean
  created_at: string
  profiles?: FeedAuthor | null
}

export interface TrendingHashtag {
  hashtag_id: string
  post_count: number
  updated_at: string
  hashtags?: { tag: string }
}

export interface CreatePostPayload {
  body: string
  tags?: string[]
  imageUrl?: string | null
  isAnonymous?: boolean
  clubId?: string | null
  studyGroupId?: string | null
  postType?: 'feed' | 'anonymous' | 'club' | 'academic'
}

// ---------------------------------------------------------------------------
// Shared select string + count normaliser
// ---------------------------------------------------------------------------

const POST_SELECT =
  '*, clubs(id, name), profiles!author_id(id, full_name, department, level, avatar_url, role, badge_type, badge_color), post_likes(count), post_comments(count), reposts(count), original_post:repost_of(*, clubs(id, name), profiles!author_id(id, full_name, department, level, avatar_url, role, badge_type, badge_color), post_likes(count), post_comments(count), reposts(count))'

function toFeedPost(raw: any): FeedPost {
  if (!raw) return raw
  const { post_likes, post_comments, reposts, original_post, ...rest } = raw
  const parsed = {
    ...rest,
    likes_count:     post_likes?.[0]?.count    ?? rest.likes_count    ?? 0,
    comments_count:  post_comments?.[0]?.count ?? rest.comments_count ?? 0,
    repost_count:    reposts?.[0]?.count        ?? rest.repost_count   ?? 0,
  } as FeedPost

  if (original_post) {
    const rawOrig = Array.isArray(original_post) ? original_post[0] : original_post
    if (rawOrig) {
      parsed.original_post = toFeedPost(rawOrig)
    }
  }
  return parsed
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

/**
 * Fetches the main campus feed with cursor-based pagination.
 * @param cursor ISO timestamp — returns posts created before this time
 * @param limit  Number of posts to return (default 20)
 */
export async function getFeed(cursor?: string, limit = 20): Promise<{
  data: FeedPost[] | null
  error: Error | null
}> {
  try {
    let query = supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: (data as any[]).map(toFeedPost), error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Creates a new post and inserts associated hashtags into post_hashtags.
 * Hashtag parsing happens client-side to keep SQL simple.
 */
export async function createPost(payload: CreatePostPayload): Promise<{
  data: FeedPost | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const isAnon = payload.isAnonymous ?? false
    const postType = payload.postType ?? (isAnon ? 'anonymous' : 'feed')

    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        body: payload.body,
        tags: payload.tags ?? [],
        image_url: payload.imageUrl ?? null,
        is_anonymous: isAnon,
        post_type: postType,
        club_id: payload.clubId ?? null,
        study_group_id: payload.studyGroupId ?? null,
      })
      .select()
      .single()

    if (postError) throw postError

    // Parse and upsert hashtags from the body text
    const hashtagMatches = payload.body.match(/#(\w+)/g) ?? []
    if (hashtagMatches.length > 0) {
      const tags = hashtagMatches.map(h => h.slice(1).toLowerCase())
      await _upsertPostHashtags(post.id, tags)
    }

    return { data: post as FeedPost, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/** Internal: upsert hashtags and link them to a post */
async function _upsertPostHashtags(postId: string, tags: string[]) {
  for (const tag of tags) {
    // Upsert hashtag row
    const { data: hashtagRow } = await supabase
      .from('hashtags')
      .upsert({ tag }, { onConflict: 'tag' })
      .select('id')
      .single()

    if (hashtagRow) {
      await supabase
        .from('post_hashtags')
        .upsert({ post_id: postId, hashtag_id: hashtagRow.id })
    }
  }
}

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------

/**
 * Toggles a like on a post.
 * Uses the `toggle_post_like` SECURITY DEFINER RPC so the count update
 * is atomic with the post_likes insert/delete.
 */
export async function likePost(postId: string): Promise<{
  data: { liked: boolean } | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .rpc('toggle_post_like', { p_post_id: postId })
    if (error) throw error
    return { data: data as { liked: boolean }, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/** Alias for likePost — kept for backwards compatibility with feed screens */
export const unlikePost = likePost

/**
 * Returns the set of post IDs that the current user has liked.
 * Used to hydrate the feed with liked state on initial load.
 */
export async function getMyLikedPostIds(postIds: string[]): Promise<string[]> {
  if (!postIds.length) return []

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', user.id)
    .in('post_id', postIds)

  return (data ?? []).map((row: { post_id: string }) => row.post_id)
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function commentOnPost(
  postId: string,
  body: string,
  isAnonymous = false,
  parentId: string | null = null,
  mediaUrl: string | null = null,
  mediaType: string | null = null
): Promise<{ data: PostComment | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        parent_id: parentId,
        author_id: user.id,
        body: body.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
        is_anonymous: isAnonymous,
      })
      .select('*, profiles!author_id(id, full_name, department, level, avatar_url, role, badge_type, badge_color)')
      .single()

    if (error) throw error

    const comment = data as any
    if (comment && comment.is_anonymous) {
      comment.author_id = null
      comment.profiles = null
    }

    return { data: comment as PostComment, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getComments(postId: string): Promise<{
  data: PostComment[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('post_comments')
      .select('*, profiles!author_id(id, full_name, department, level, avatar_url, role, badge_type, badge_color)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) throw error

    const sanitized = (data ?? []).map((c: any) => {
      if (c.is_anonymous) {
        return { ...c, author_id: null, profiles: null }
      }
      return c
    })

    return { data: sanitized as PostComment[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function deleteComment(commentId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Reposts
// ---------------------------------------------------------------------------

/**
 * Reposts (or quote-reposts) a post.
 * Creates a row in `reposts` for tracking and a new `posts` row with
 * `repost_of` set, so the feed timeline stays flat.
 */
export async function repostPost(
  postId: string,
  quoteBody?: string
): Promise<{ data: FeedPost | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Guard: check if the user has already reposted this post
    const { data: existingRepost } = await supabase
      .from('reposts')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingRepost) {
      throw new Error('You have already reposted this post')
    }

    // Fetch original post to copy its content into the repost row
    const { data: original, error: origError } = await supabase
      .from('posts')
      .select('body, tags, image_url')
      .eq('id', postId)
      .single()

    if (origError) throw origError

    // Insert the repost tracking record
    const { error: repostError } = await supabase
      .from('reposts')
      .insert({ post_id: postId, user_id: user.id, quote_body: quoteBody ?? null })

    if (repostError) throw repostError

    // Insert a new post entry that references the original
    const newBody = quoteBody
      ? quoteBody
      : ''

    const { data: newPost, error: newPostError } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        body: newBody,
        tags: original.tags,
        image_url: original.image_url,
        repost_of: postId,
        post_type: 'feed',
      })
      .select(POST_SELECT)
      .single()

    if (newPostError) throw newPostError
    return { data: toFeedPost(newPost), error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Hashtags
// ---------------------------------------------------------------------------

export async function getHashtagPosts(
  tag: string,
  cursor?: string,
  limit = 20
): Promise<{ data: FeedPost[] | null; error: Error | null }> {
  try {
    // Resolve hashtag id
    const { data: hashtagRow, error: hError } = await supabase
      .from('hashtags')
      .select('id')
      .eq('tag', tag.toLowerCase())
      .single()

    if (hError) {
      if (hError.code === 'PGRST116') return { data: [], error: null }
      throw hError
    }
    if (!hashtagRow) return { data: [], error: null }

    // Get post IDs for this hashtag
    const { data: links, error: linkError } = await supabase
      .from('post_hashtags')
      .select('post_id')
      .eq('hashtag_id', hashtagRow.id)

    if (linkError) throw linkError

    const postIds = (links ?? []).map((l: { post_id: string }) => l.post_id)
    if (!postIds.length) return { data: [], error: null }

    let query = supabase
      .from('posts')
      .select(POST_SELECT)
      .in('id', postIds)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: (data as any[]).map(toFeedPost), error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getTrending(): Promise<{
  data: TrendingHashtag[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('trending_hashtags')
      .select('*, hashtags(tag)')
      .order('post_count', { ascending: false })
      .limit(20)

    if (error) throw error
    return { data: data as TrendingHashtag[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

export async function bookmarkPost(postId: string): Promise<{
  data: { bookmarked: boolean } | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: existing } = await supabase
      .from('post_bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .maybeSingle()

    if (existing) {
      await supabase.from('post_bookmarks').delete()
        .eq('user_id', user.id).eq('post_id', postId)
      return { data: { bookmarked: false }, error: null }
    } else {
      await supabase.from('post_bookmarks').insert({ user_id: user.id, post_id: postId })
      return { data: { bookmarked: true }, error: null }
    }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getBookmarkedPosts(): Promise<{ data: FeedPost[] | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const bookmarkSelect = `post_id, posts(${POST_SELECT})`

    const { data, error } = await supabase
      .from('post_bookmarks')
      .select(bookmarkSelect)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const posts = (data ?? [])
      .map((r: any) => r.posts)
      .filter(Boolean)
      .map((raw: any) => ({ ...toFeedPost(raw), is_bookmarked: true }))

    return { data: posts, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getMyBookmarkedPostIds(postIds: string[]): Promise<string[]> {
  if (!postIds.length) return []
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('post_bookmarks')
    .select('post_id')
    .eq('user_id', user.id)
    .in('post_id', postIds)
  return (data ?? []).map((r: { post_id: string }) => r.post_id)
}

// ---------------------------------------------------------------------------
// Following feed
// ---------------------------------------------------------------------------

export async function getFollowingFeed(
  cursor?: string,
  limit = 20
): Promise<{ data: FeedPost[] | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: followRows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followingIds: string[] = (followRows ?? []).map(
      (r: { following_id: string }) => r.following_id
    )

    if (!followingIds.length) return { data: [], error: null }

    let query = supabase
      .from('posts')
      .select(POST_SELECT)
      .in('author_id', followingIds)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (cursor) query = query.lt('created_at', cursor)

    const { data, error } = await query
    if (error) throw error
    return { data: (data as any[]).map(toFeedPost), error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Single post
// ---------------------------------------------------------------------------

export async function getPost(postId: string): Promise<{
  data: FeedPost | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('id', postId)
      .single()

    if (error) throw error
    return { data: toFeedPost(data), error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getUserFeedPosts(userId: string): Promise<{
  data: FeedPost[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('author_id', userId)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return { data: (data as any[]).map(toFeedPost), error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function deletePost(postId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function reportPost(postId: string, reason?: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('reports')
      .insert({ reporter_id: user.id, post_id: postId, reason: reason ?? null })

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
