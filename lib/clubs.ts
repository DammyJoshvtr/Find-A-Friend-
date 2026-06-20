/**
 * lib/clubs.ts
 * Social clubs: list, detail, join, leave, feed, announcements.
 *
 * Clubs are created by admins only (RLS enforces role = 'admin').
 * Any authenticated user can join or leave a club.
 * Club announcements can only be posted by club admins/moderators.
 */
import { client } from './aws'
import { getCurrentUser } from 'aws-amplify/auth'
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
  settings_send_messages?: 'all' | 'admins'
  settings_edit_info?: 'all' | 'admins'
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
    const filter: any = { is_active: { eq: true } }
    if (filters?.category) {
      filter.category = { eq: filters.category }
    }

    if (filters?.search) {
      filter.name = { contains: filters.search }
    }

    const { data, errors: errorList } = await client.models.Club.list({ filter })
    const error = errorList ? errorList[0] : null
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
    const currentUser = await getCurrentUser()
    const user = { id: currentUser.userId }
    if (!user) throw new Error('Not authenticated')

    const slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-',).replace(/(^-|-$)/g, '')

    const { data, errors: errorList } = await client.models.Club.create({
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
    const error = errorList ? errorList[0] : null

    if (error) throw error
    if (!data) throw new Error('Club was created but the database did not return the new club record.')

    // Auto-join as admin
    await client.models.ClubMember.create({
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
// Update club (admin only — enforced by RLS)
// ---------------------------------------------------------------------------

export interface UpdateClubPayload {
  name?: string
  description?: string | null
  category?: string
  color?: string
  cover_url?: string | null
}

export async function updateClub(
  clubId: string,
  payload: UpdateClubPayload
): Promise<{ error: Error | null }> {
  try {
    const { errors: errorList } = await client.models.Club.update({ id: clubId, ...payload })
    const error = errorList ? errorList[0] : null
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err as Error }
  }
}

export async function uploadClubCover(uri: string): Promise<{
  data: string | null
  error: Error | null
}> {
  try {
    const ext = uri.split('.').pop()?.split('?')[0] ?? 'jpg'
    const filename = `club-cover-${Date.now()}.${ext}`
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
    const publicUrl = await uploadFile('club-covers', filename, uri, mimeType, true)
    return { data: publicUrl, error: null }
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
    const { data, errors: errorList } = await client.models.Club.get({ id: clubId })
    const error = errorList ? errorList[0] : null

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
  const currentUser = await getCurrentUser().catch(() => null)
  if (!currentUser) return null
  const user = { id: currentUser.userId }

  const { data } = await client.models.ClubMember.list({
    filter: { club_id: { eq: clubId }, user_id: { eq: user.id } }
  })

  return data?.[0]?.role ?? null
}

/**
 * For a list of club IDs, returns a Map of clubId → role for the current user.
 */
export async function getMyClubMemberships(
  clubIds: string[]
): Promise<Map<string, 'member' | 'moderator' | 'admin'>> {
  if (!clubIds.length) return new Map()

  const currentUser = await getCurrentUser().catch(() => null)
  if (!currentUser) return new Map()
  const user = { id: currentUser.userId }

  const { data } = await client.models.ClubMember.list({
    filter: {
      user_id: { eq: user.id },
      or: clubIds.map(id => ({ club_id: { eq: id } }))
    }
  })

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
    const currentUser = await getCurrentUser()
    const user = { id: currentUser.userId }
    if (!user) throw new Error('Not authenticated')

    const { data, errors: errorList } = await client.models.ClubMember.create({ club_id: clubId, user_id: user.id, role: 'member' })
    const error: any = errorList ? errorList[0] : null

    if (error && error.errorType === 'DynamoDB:ConditionalCheckFailedException') {
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
    const currentUser = await getCurrentUser()
    const user = { id: currentUser.userId }
    if (!user) throw new Error('Not authenticated')

    const { data: memberships } = await client.models.ClubMember.list({
      filter: { club_id: { eq: clubId }, user_id: { eq: user.id } }
    })
    const error = null
    if (memberships && memberships.length > 0) {
      const { errors } = await client.models.ClubMember.delete({ id: memberships[0].id })
      if (errors) throw errors[0]
    }

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
    let filter: any = { club_id: { eq: clubId } }
    if (cursor) {
      filter.created_at = { lt: cursor }
    }

    const { data, errors: errorList } = await client.models.Post.list({
      filter,
      limit
    })
    const error = errorList ? errorList[0] : null
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
    const currentUser = await getCurrentUser()
    const user = { id: currentUser.userId }
    if (!user) throw new Error('Not authenticated')

    const { data, errors: errorList } = await client.models.Post.create({
      author_id: user.id,
      body,
      tags: tags ?? [],
      image_url: imageUrl ?? null,
      club_id: clubId,
      post_type: 'club',
      is_anonymous: false,
    })
    const error = errorList ? errorList[0] : null

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
    const { data, errors: errorList } = await client.models.ClubAnnouncement.list({
      filter: { club_id: { eq: clubId } }
    })
    const error = errorList ? errorList[0] : null

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
    const currentUser = await getCurrentUser()
    const user = { id: currentUser.userId }
    if (!user) throw new Error('Not authenticated')

    const { data, errors: errorList } = await client.models.ClubAnnouncement.create({ club_id: clubId, author_id: user.id, body })
    const error = errorList ? errorList[0] : null

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
    const { data, errors: errorList } = await client.models.ClubMember.list({
      filter: { club_id: { eq: clubId } },
      limit
    })
    const error: any = errorList ? errorList[0] : null

    if (error) {
      throw error
    }
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
    const { data, errors: errorList } = await client.models.Event.list({
      filter: {
        club_id: { eq: clubId },
        is_public: { eq: true },
        starts_at: { ge: new Date().toISOString() }
      }
    })
    const error = errorList ? errorList[0] : null

    if (error) throw error
    return { data: data as Event[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Club Management (Admin Actions)
// ---------------------------------------------------------------------------

export async function deleteClub(clubId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { errors: errorList } = await client.models.Club.delete({ id: clubId })
    const error = errorList ? errorList[0] : null

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function addClubMember(
  clubId: string,
  userId: string
): Promise<{
  data: ClubMember | null
  error: Error | null
}> {
  try {
    const { data, errors: errorList } = await client.models.ClubMember.create({
      club_id: clubId,
      user_id: userId,
      role: 'member',
    })
    const error = errorList ? errorList[0] : null

    if (error) throw error
    return { data: data as ClubMember, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function updateClubMemberRole(
  clubId: string,
  userId: string,
  role: 'member' | 'moderator' | 'admin'
): Promise<{
  data: ClubMember | null
  error: Error | null
}> {
  try {
    const { data: members } = await client.models.ClubMember.list({
      filter: { club_id: { eq: clubId }, user_id: { eq: userId } }
    })
    if (!members || members.length === 0) throw new Error('Member not found')
    const { data, errors: errorList } = await client.models.ClubMember.update({
      id: members[0].id,
      role
    })
    const error = errorList ? errorList[0] : null

    if (error) throw error
    return { data: data as ClubMember, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function removeClubMember(
  clubId: string,
  userId: string
): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: members } = await client.models.ClubMember.list({
      filter: { club_id: { eq: clubId }, user_id: { eq: userId } }
    })
    const error = null;
    if (members && members.length > 0) {
      const { errors: errorList } = await client.models.ClubMember.delete({ id: members[0].id })
      if (errorList) throw errorList[0]
    }

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
