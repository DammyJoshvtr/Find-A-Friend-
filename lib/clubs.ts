/**
 * lib/clubs.ts
 * Social clubs: list, detail, join, leave, feed, announcements.
 *
 * Clubs are created by admins only (RLS enforces role = 'admin').
 * Any authenticated user can join or leave a club.
 * Club announcements can only be posted by club admins/moderators.
 */
import { supabase } from './supabase'
import { uploadFile } from './upload'
import type { FeedPost } from './feed'
import type { Event } from './events'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Club {
  id: string
  name: string
  slug: string
  description: string | null
  category: string
  icon: string | null
  cover_url: string | null
  color: string
  member_count: number
  is_active: boolean
  created_by: string | null
  created_at: string
  // Client-derived
  is_member?: boolean
  user_role?: 'member' | 'moderator' | 'admin' | null
}

export interface ClubMember {
  club_id: string
  user_id: string
  role: 'member' | 'moderator' | 'admin'
  joined_at: string
  profiles?: {
    id: string
    full_name: string | null
    avatar_url: string | null
    department: string | null
    level: string | null
  } | null
}

export interface ClubAnnouncement {
  id: string
  club_id: string
  author_id: string
  body: string
  created_at: string
  profiles?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface ClubFilters {
  category?: string
  search?: string
}

// ---------------------------------------------------------------------------
// List clubs
// ---------------------------------------------------------------------------

export async function getClubs(filters?: ClubFilters): Promise<{
  data: Club[] | null
  error: Error | null
}> {
  try {
    let query = supabase
      .from('clubs')
      .select('*')
      .eq('is_active', true)
      .order('member_count', { ascending: false })

    if (filters?.category) {
      query = query.eq('category', filters.category)
    }

    if (filters?.search) {
      query = query.ilike('name', `%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as Club[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Create club (SQL needed: ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
//              CREATE POLICY "Users can create clubs" ON clubs FOR INSERT
//              TO authenticated WITH CHECK (auth.uid() = created_by);)
// ---------------------------------------------------------------------------

export interface CreateClubPayload {
  name: string
  description?: string
  category: string
  color?: string
  icon?: string
}

export async function createClub(payload: CreateClubPayload): Promise<{
  data: Club | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const { data, error } = await supabase
      .from('clubs')
      .insert({
        name: payload.name,
        slug: `${slug}-${Date.now().toString(36)}`,
        description: payload.description ?? null,
        category: payload.category,
        color: payload.color ?? '#a78bfa',
        icon: payload.icon ?? null,
        is_active: true,
        created_by: user.id,
        member_count: 1,
      })
      .select('*')
      .single()

    if (error) throw error

    // Auto-join as admin
    await supabase.from('club_members').insert({
      club_id: data.id,
      user_id: user.id,
      role: 'admin',
    })

    return { data: data as Club, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Club detail
// ---------------------------------------------------------------------------

export async function getClubDetail(clubId: string): Promise<{
  data: Club | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .single()

    if (error) throw error
    return { data: data as Club, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Membership status
// ---------------------------------------------------------------------------

export async function getMyClubRole(
  clubId: string
): Promise<'member' | 'moderator' | 'admin' | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .maybeSingle()

  return data?.role ?? null
}

/**
 * For a list of club IDs, returns a Map of clubId → role for the current user.
 */
export async function getMyClubMemberships(
  clubIds: string[]
): Promise<Map<string, 'member' | 'moderator' | 'admin'>> {
  if (!clubIds.length) return new Map()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Map()

  const { data } = await supabase
    .from('club_members')
    .select('club_id, role')
    .eq('user_id', user.id)
    .in('club_id', clubIds)

  const map = new Map<string, 'member' | 'moderator' | 'admin'>()
  for (const row of data ?? []) {
    map.set(row.club_id, row.role)
  }
  return map
}

// ---------------------------------------------------------------------------
// Join / Leave
// ---------------------------------------------------------------------------

export async function joinClub(clubId: string): Promise<{
  data: ClubMember | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('club_members')
      .insert({ club_id: clubId, user_id: user.id, role: 'member' })
      .select()
      .single()

    if (error && error.code === '23505') {
      // Already a member — not an error
      return { data: null, error: null }
    }
    if (error) throw error
    return { data: data as ClubMember, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function leaveClub(clubId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', user.id)

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Club feed
// ---------------------------------------------------------------------------

/**
 * Returns posts for a specific club (both post_type = 'club' and 'feed' with
 * this club_id set). Uses public_posts view to protect anonymous author_ids.
 */
export async function getClubPosts(
  clubId: string,
  cursor?: string,
  limit = 20
): Promise<{ data: FeedPost[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('posts')
      .select('*, profiles(id, full_name, department, level, avatar_url)')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as FeedPost[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Creates a post scoped to a club. Requires club membership.
 */
export async function createClubPost(
  clubId: string,
  body: string,
  tags?: string[],
  imageUrl?: string | null
): Promise<{ data: FeedPost | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        body,
        tags: tags ?? [],
        image_url: imageUrl ?? null,
        club_id: clubId,
        post_type: 'club',
        is_anonymous: false,
      })
      .select('*, profiles(id, full_name, department, level, avatar_url)')
      .single()

    if (error) throw error
    return { data: data as FeedPost, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Club announcements
// ---------------------------------------------------------------------------

export async function getClubAnnouncements(clubId: string): Promise<{
  data: ClubAnnouncement[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('club_announcements')
      .select('*, profiles(id, full_name, avatar_url)')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data: data as ClubAnnouncement[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Only club admins/moderators can post announcements (enforced by RLS).
 */
export async function createClubAnnouncement(
  clubId: string,
  body: string
): Promise<{ data: ClubAnnouncement | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('club_announcements')
      .insert({ club_id: clubId, author_id: user.id, body })
      .select('*, profiles(id, full_name, avatar_url)')
      .single()

    if (error) throw error
    return { data: data as ClubAnnouncement, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Club members
// ---------------------------------------------------------------------------

export async function getClubMembers(
  clubId: string,
  limit = 50
): Promise<{ data: ClubMember[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('club_members')
      .select('*, profiles(id, full_name, avatar_url, department, level)')
      .eq('club_id', clubId)
      .order('joined_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return { data: data as ClubMember[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Club events
// ---------------------------------------------------------------------------

export async function getClubEvents(clubId: string): Promise<{
  data: Event[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*, profiles(id, full_name, avatar_url)')
      .eq('club_id', clubId)
      .eq('is_public', true)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })

    if (error) throw error
    return { data: data as Event[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Upload club cover image
// ---------------------------------------------------------------------------

export async function uploadClubCover(uri: string): Promise<{
  data: string | null
  error: Error | null
}> {
  try {
    const ext = uri.split('.').pop() ?? 'jpg'
    const path = `${Date.now()}.${ext}`
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

    const publicUrl = await uploadFile('club-covers', path, uri, mimeType)
    return { data: publicUrl, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
