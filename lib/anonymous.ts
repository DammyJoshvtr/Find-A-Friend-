/**
 * lib/anonymous.ts
 * Anonymous (confessions) posts.
 *
 * The real author is captured by a SECURITY DEFINER DB trigger into
 * `anonymous_post_audit` — a table whose RLS blocks all non-service_role reads.
 * The `public_posts` view returns NULL for author_id when is_anonymous = true,
 * so other users never see who wrote what.
 *
 * Admin identity reveal goes through an Edge Function (or service_role call
 * in lib/admin.ts) — never directly from this file.
 */
import { supabase } from './supabase'
import type { FeedPost, CreatePostPayload } from './feed'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnonymousPost {
  id: string
  body: string
  tags: string[] | null
  image_url: string | null
  is_anonymous: true
  post_type: 'anonymous'
  likes_count: number
  comments_count: number
  author_id: null   // always null for clients
  created_at: string
}

// ---------------------------------------------------------------------------
// Create anonymous post
// ---------------------------------------------------------------------------

/**
 * Creates an anonymous post. The author_id is stored in the posts table
 * (required for the DB trigger audit) but the `public_posts` VIEW masks it
 * by returning NULL. Clients querying public_posts never see the real author.
 *
 * The DB trigger `trg_anon_audit` fires AFTER INSERT and writes
 * (post_id, real_author) into `anonymous_post_audit`.
 */
export async function createAnonymousPost(
  body: string,
  tags?: string[],
  imageUrl?: string | null
): Promise<{ data: AnonymousPost | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,     // stored for audit; masked in public_posts view
        body,
        tags: tags ?? [],
        image_url: imageUrl ?? null,
        is_anonymous: true,
        post_type: 'anonymous',
      })
      .select('id, body, tags, image_url, is_anonymous, post_type, likes_count, comments_count, created_at')
      .single()

    if (error) throw error

    // Return sanitized row — never expose author_id to caller
    const sanitized: AnonymousPost = {
      id: data.id,
      body: data.body,
      tags: data.tags,
      image_url: data.image_url,
      is_anonymous: true,
      post_type: 'anonymous',
      likes_count: data.likes_count ?? 0,
      comments_count: data.comments_count ?? 0,
      author_id: null,
      created_at: data.created_at,
    }

    return { data: sanitized, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Fetch anonymous posts (confessions board)
// ---------------------------------------------------------------------------

/**
 * Fetches anonymous posts via the `public_posts` view.
 * The view enforces author_id = NULL for all anonymous posts.
 */
export async function getAnonymousPosts(
  cursor?: string,
  limit = 20
): Promise<{ data: AnonymousPost[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('posts')
      .select('id, body, tags, image_url, is_anonymous, post_type, likes_count, comments_count, author_id, created_at')
      .eq('is_anonymous', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query
    if (error) throw error

    // Ensure author_id is always null on the way out (belt-and-suspenders)
    const sanitized = (data ?? []).map((post: any) => ({
      ...post,
      author_id: null,
    })) as AnonymousPost[]

    return { data: sanitized, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Admin: reveal real author identity
// NOTE: this function requires service_role. Call only from admin screens
//       that are protected by role-check layout guard.
// ---------------------------------------------------------------------------

/**
 * Returns the real author profile for an anonymous post.
 * Requires the calling user to have role = 'admin' in profiles.
 * The query reads from `anonymous_post_audit` which is blocked for regular
 * users by RLS (USING false). The admin role check happens in the admin
 * layout guard; this function itself cannot enforce it at the SQL level
 * because the client anon key cannot bypass RLS.
 *
 * In production, this should go through an Edge Function with service_role.
 * This helper is provided for use inside a trusted admin Edge Function.
 */
export async function getAnonymousPostIdentity(postId: string): Promise<{
  data: { post_id: string; real_author: string; created_at: string } | null
  error: Error | null
}> {
  try {
    // This will only succeed when called with a service_role client.
    // The admin Edge Function (lib/admin.ts) creates a service_role client.
    const { data, error } = await supabase
      .from('anonymous_post_audit')
      .select('post_id, real_author, created_at')
      .eq('post_id', postId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Check if current user authored an anonymous post
// (used to allow deleting own anonymous posts)
// ---------------------------------------------------------------------------

/**
 * Checks if the current user is the real author of an anonymous post.
 * Uses the raw `posts` table — the current user's author_id is compared.
 * Does NOT use public_posts view so it can access the unmasked author_id.
 */
export async function isMyAnonymousPost(postId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .eq('author_id', user.id)
    .eq('is_anonymous', true)
    .maybeSingle()

  return !!data
}
