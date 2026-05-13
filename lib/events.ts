/**
 * lib/events.ts
 * Events: create, list (with filters), RSVP, cancel RSVP, attendees.
 *
 * The `rsvp_count` on events is maintained by a DB trigger.
 * Events are visible only when `is_public = true` per RLS policy.
 */
import { supabase } from './supabase'
import { uploadFile } from './upload'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Event {
  id: string
  title: string
  venue: string | null
  starts_at: string
  ends_at: string | null
  description: string | null
  organizer_id: string | null
  club_id: string | null
  category: string | null
  cover_image_url: string | null
  rsvp_count: number
  capacity: number | null
  is_public: boolean
  map_pin_x: number | null
  map_pin_y: number | null
  map_location_id: string | null
  created_at?: string
  // Joined relations
  profiles?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
  clubs?: {
    id: string
    name: string
    color: string
  } | null
  map_locations?: {
    id: string
    name: string
    pin_x: number
    pin_y: number
  } | null
  // Client-derived
  user_rsvp_status?: 'going' | 'interested' | 'not_going' | null
}

export interface EventRsvp {
  id: string
  event_id: string
  user_id: string
  status: 'going' | 'interested' | 'not_going'
  created_at: string
  profiles?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface CreateEventPayload {
  title: string
  venue?: string
  startsAt: string
  endsAt?: string
  description?: string
  category?: string
  coverImageUrl?: string
  capacity?: number
  isPublic?: boolean
  clubId?: string
  mapLocationId?: string
  mapPinX?: number
  mapPinY?: number
}

export interface EventFilters {
  date?: string       // ISO date string — filter events starting on this day
  category?: string
  clubId?: string
  upcoming?: boolean  // Only events in the future (default true)
}

// ---------------------------------------------------------------------------
// Fetch events
// ---------------------------------------------------------------------------

export async function getEvents(
  filters?: EventFilters,
  cursor?: string,
  limit = 20
): Promise<{ data: Event[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('events')
      .select(`
        *,
        profiles(id, full_name, avatar_url),
        clubs(id, name, color)
      `)
      .eq('is_public', true)
      .order('starts_at', { ascending: true })
      .limit(limit)

    // Default: only upcoming events
    if (filters?.upcoming !== false) {
      query = query.gte('starts_at', new Date().toISOString())
    }

    if (filters?.category) {
      query = query.eq('category', filters.category)
    }

    if (filters?.clubId) {
      query = query.eq('club_id', filters.clubId)
    }

    if (filters?.date) {
      // Filter events that start on the given date (local midnight–midnight)
      const dayStart = new Date(filters.date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(filters.date)
      dayEnd.setHours(23, 59, 59, 999)
      query = query
        .gte('starts_at', dayStart.toISOString())
        .lte('starts_at', dayEnd.toISOString())
    }

    if (cursor) {
      query = query.gt('starts_at', cursor)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as Event[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getEventDetail(eventId: string): Promise<{
  data: Event | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        profiles(id, full_name, avatar_url),
        clubs(id, name, color)
      `)
      .eq('id', eventId)
      .single()

    if (error) throw error
    return { data: data as Event, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Create event
// ---------------------------------------------------------------------------

export async function createEvent(payload: CreateEventPayload): Promise<{
  data: Event | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('events')
      .insert({
        organizer_id: user.id,
        title: payload.title,
        venue: payload.venue ?? null,
        starts_at: payload.startsAt,
        ends_at: payload.endsAt ?? null,
        description: payload.description ?? null,
        category: payload.category ?? null,
        cover_image_url: payload.coverImageUrl ?? null,
        capacity: payload.capacity ?? null,
        is_public: payload.isPublic ?? true,
        club_id: payload.clubId ?? null,
        map_location_id: payload.mapLocationId ?? null,
        map_pin_x: payload.mapPinX ?? null,
        map_pin_y: payload.mapPinY ?? null,
      })
      .select(`
        *,
        profiles(id, full_name, avatar_url),
        clubs(id, name, color)
      `)
      .single()

    if (error) throw error
    return { data: data as Event, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// RSVP
// ---------------------------------------------------------------------------

export async function rsvpEvent(
  eventId: string,
  status: 'going' | 'interested' | 'not_going'
): Promise<{ data: EventRsvp | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('event_rsvps')
      .upsert(
        { event_id: eventId, user_id: user.id, status },
        { onConflict: 'event_id,user_id' }
      )
      .select()
      .single()

    if (error) throw error
    return { data: data as EventRsvp, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function cancelRsvp(eventId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id)

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getMyRsvpStatus(eventId: string): Promise<{
  data: 'going' | 'interested' | 'not_going' | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: null }

    const { data, error } = await supabase
      .from('event_rsvps')
      .select('status')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    return { data: data?.status ?? null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Returns all RSVPs for an event, optionally filtered by status.
 */
export async function getEventAttendees(
  eventId: string,
  status?: 'going' | 'interested' | 'not_going'
): Promise<{ data: EventRsvp[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('event_rsvps')
      .select('*, profiles(id, full_name, avatar_url, department, level)')
      .eq('event_id', eventId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as EventRsvp[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Returns all events the current user has RSVP'd to.
 */
export async function getMyRsvps(): Promise<{
  data: Array<{ rsvp: EventRsvp; event: Event }> | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('event_rsvps')
      .select(`
        *,
        events(*, profiles(id, full_name, avatar_url), clubs(id, name, color))
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    const result = (data ?? []).map((row: any) => ({
      rsvp: row as EventRsvp,
      event: row.events as Event,
    }))
    return { data: result, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Upload event cover image
// ---------------------------------------------------------------------------

export async function uploadEventCover(uri: string): Promise<{
  data: string | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const ext = uri.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

    const publicUrl = await uploadFile('event-covers', path, uri, mimeType)
    return { data: publicUrl, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
