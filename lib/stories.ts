/**
 * lib/stories.ts
 * Stories: create, fetch (grouped by author), mark viewed, delete expired.
 *
 * Stories expire 24 hours after creation. The RLS policy on `stories` already
 * filters by `expires_at > now()`, so queries automatically exclude expired
 * rows. Additionally, `deleteExpiredStories` can be called client-side on
 * foreground to assist cleanup on the free Supabase tier (no pg_cron).
 */
import { supabase } from './supabase'
import { uploadFile } from './upload'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Story {
  id: string
  author_id: string
  media_url: string
  media_type: 'image' | 'video'
  caption: string | null
  duration_secs: number
  expires_at: string
  view_count: number
  created_at: string
  profiles?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

/** A group of stories belonging to a single author, sorted newest-first */
export interface StoryGroup {
  author_id: string
  author_name: string | null
  author_avatar: string | null
  /** True if the current user has already viewed ALL stories in this group */
  all_viewed: boolean
  stories: Story[]
}

export interface CreateStoryPayload {
  /** Fully qualified public URL or signed URL of the uploaded media */
  mediaUrl: string
  mediaType?: 'image' | 'video'
  caption?: string
  durationSecs?: number
}

// ---------------------------------------------------------------------------
// Fetch stories bar (grouped by author, following + own)
// ---------------------------------------------------------------------------

/**
 * Returns stories from followed users (plus the current user's own stories),
 * grouped by author. Groups with unseen stories appear first.
 */
export async function getStories(): Promise<{
  data: StoryGroup[] | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Fetch IDs of users the current user follows + their own ID
    const { data: followRows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followingIds: string[] = (followRows ?? []).map(
      (r: { following_id: string }) => r.following_id
    )
    const authorIds = Array.from(new Set([user.id, ...followingIds]))

    // Fetch non-expired stories for those authors (RLS also filters)
    const { data: storyRows, error: storiesError } = await supabase
      .from('stories')
      .select('*, profiles!stories_author_id_fkey(id, full_name, avatar_url)')
      .in('author_id', authorIds)
      .order('created_at', { ascending: false })

    if (storiesError) throw storiesError

    // Fetch the story IDs already viewed by current user
    const storyIds = (storyRows ?? []).map((s: Story) => s.id)
    const viewedIds = await _getViewedStoryIds(user.id, storyIds)
    const viewedSet = new Set(viewedIds)

    // Group by author
    const groups = new Map<string, StoryGroup>()
    for (const story of storyRows ?? []) {
      const authorId: string = story.author_id
      if (!groups.has(authorId)) {
        groups.set(authorId, {
          author_id: authorId,
          author_name: story.profiles?.full_name ?? null,
          author_avatar: story.profiles?.avatar_url ?? null,
          all_viewed: true,
          stories: [],
        })
      }
      const group = groups.get(authorId)!
      group.stories.push(story as Story)
      if (!viewedSet.has(story.id)) {
        group.all_viewed = false
      }
    }

    // Sort: own story first, then unviewed groups, then viewed groups
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      if (a.author_id === user.id) return -1
      if (b.author_id === user.id) return 1
      if (a.all_viewed && !b.all_viewed) return 1
      if (!a.all_viewed && b.all_viewed) return -1
      return 0
    })

    return { data: sortedGroups, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/** Returns story IDs that the viewer has already seen */
async function _getViewedStoryIds(
  viewerId: string,
  storyIds: string[]
): Promise<string[]> {
  if (!storyIds.length) return []

  const { data } = await supabase
    .from('story_views')
    .select('story_id')
    .eq('viewer_id', viewerId)
    .in('story_id', storyIds)

  return (data ?? []).map((r: { story_id: string }) => r.story_id)
}

// ---------------------------------------------------------------------------
// Create story
// ---------------------------------------------------------------------------

/**
 * Inserts a story row. The media must already be uploaded to the `stories`
 * storage bucket before calling this function.
 */
export async function createStory(payload: CreateStoryPayload): Promise<{
  data: Story | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('stories')
      .insert({
        author_id: user.id,
        media_url: payload.mediaUrl,
        media_type: payload.mediaType ?? 'image',
        caption: payload.caption ?? null,
        duration_secs: payload.durationSecs ?? 5,
        // expires_at defaults to now() + 24h in the DB
      })
      .select('*, profiles!stories_author_id_fkey(id, full_name, avatar_url)')
      .single()

    if (error) throw error
    return { data: data as Story, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Upload story media
// ---------------------------------------------------------------------------

/**
 * Uploads media for a story to the `stories` storage bucket.
 * Returns the public URL.
 */
export async function uploadStoryMedia(uri: string, mimeType: string): Promise<{
  data: string | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const ext = mimeType.split('/')[1]?.split(';')[0] ?? uri.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`
    const publicUrl = await uploadFile('stories', path, uri, mimeType)
    return { data: publicUrl, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Mark story viewed
// ---------------------------------------------------------------------------

/**
 * Records that the current user has viewed a story.
 * Idempotent — uses upsert to avoid duplicate errors.
 */
export async function markStoryViewed(storyId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('story_views')
      .upsert(
        { story_id: storyId, viewer_id: user.id },
        { onConflict: 'story_id,viewer_id' }
      )

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Delete own story
// ---------------------------------------------------------------------------

export async function deleteStory(storyId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId)

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Client-side expired story cleanup
// ---------------------------------------------------------------------------

/**
 * Deletes expired stories from the DB for the current user.
 * Call this on app foreground as a client-side cleanup fallback.
 * The DB trigger / Edge Function handles global cleanup.
 */
export async function deleteExpiredStories(): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: null }

    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('author_id', user.id)
      .lt('expires_at', new Date().toISOString())

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Story viewers (for the story author to see who viewed)
// ---------------------------------------------------------------------------

export async function getStoryViewers(storyId: string): Promise<{
  data: Array<{ viewer_id: string; viewed_at: string; profiles?: Array<{ full_name: string | null; avatar_url: string | null }> }> | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('story_views')
      .select('viewer_id, viewed_at, profiles(full_name, avatar_url)')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
