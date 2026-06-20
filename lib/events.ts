/**
 * lib/events.ts
 * Events: create, list (with filters), RSVP, cancel RSVP, attendees.
 *
 * The `rsvp_count` on events is maintained by a DB trigger.
 * Events are visible only when `is_public = true` per RLS policy.
 */
import { client } from './aws'
import { getCurrentUser } from 'aws-amplify/auth'
import { uploadFile } from './upload'
import { scheduleEventReminders, cancelEventReminders } from './notifications'

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
  isAnonymousLinked?: boolean
}

export interface UpdateEventPayload {
  title?: string
  venue?: string
  startsAt?: string
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
    let filter: any = { is_public: { eq: true } }

    // Default: only upcoming events
    if (filters?.upcoming !== false) {
      filter.starts_at = { ge: new Date().toISOString() }
    }

    if (filters?.category) {
      filter.category = { eq: filters.category }
    }

    if (filters?.clubId) {
      filter.club_id = { eq: filters.clubId }
    }

    if (filters?.date) {
      // Filter events that start on the given date (local midnight–midnight)
      const dayStart = new Date(filters.date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(filters.date)
      dayEnd.setHours(23, 59, 59, 999)
      filter.and = [
        { starts_at: { ge: dayStart.toISOString() } },
        { starts_at: { le: dayEnd.toISOString() } }
      ]
    }

    if (cursor) {
      filter.starts_at = { gt: cursor }
    }

    const { data, errors } = await client.models.Event.list({ filter, limit })
    if (errors) throw new Error(errors[0].message)
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
    const { data, errors } = await client.models.Event.get({ id: eventId })

    if (errors) throw new Error(errors[0].message)
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
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { data, errors } = await client.models.Event.create({
        organizer_id: user.userId,
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
        is_anonymous_linked: payload.isAnonymousLinked ?? false,
      })

    if (errors) throw new Error(errors[0].message)

    // Auto-RSVP the organizer as 'going' so the event appears in their My Events tab
    await client.models.EventRsvp.create({ event_id: data.id, user_id: user.userId, status: 'going' })

    // Schedule local reminders
    await scheduleEventReminders(data.id, data.title, data.starts_at)

    return { data: data as Event, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Update event
// ---------------------------------------------------------------------------

export async function updateEvent(eventId: string, payload: UpdateEventPayload): Promise<{
  data: Event | null
  error: Error | null
}> {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const updates: any = {}
    if (payload.title !== undefined) updates.title = payload.title
    if (payload.venue !== undefined) updates.venue = payload.venue
    if (payload.startsAt !== undefined) updates.starts_at = payload.startsAt
    if (payload.endsAt !== undefined) updates.ends_at = payload.endsAt
    if (payload.description !== undefined) updates.description = payload.description
    if (payload.category !== undefined) updates.category = payload.category
    if (payload.coverImageUrl !== undefined) updates.cover_image_url = payload.coverImageUrl
    if (payload.capacity !== undefined) updates.capacity = payload.capacity
    if (payload.isPublic !== undefined) updates.is_public = payload.isPublic
    if (payload.clubId !== undefined) updates.club_id = payload.clubId

    const { data, errors } = await client.models.Event.update({ id: eventId, ...updates })

    if (errors) throw new Error(errors[0].message)
    
    // Reschedule reminders if time/title changed
    if (payload.startsAt || payload.title) {
      await cancelEventReminders(eventId)
      await scheduleEventReminders(data.id, data.title, data.starts_at)
    }

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
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const res = await client.models.EventRsvp.list({ filter: { event_id: { eq: eventId }, user_id: { eq: user.userId } } })
    let data;
    let errors;
    if (res.data && res.data.length > 0) {
      ({ data, errors } = await client.models.EventRsvp.update({ id: res.data[0].id, status }))
    } else {
      ({ data, errors } = await client.models.EventRsvp.create({ event_id: eventId, user_id: user.userId, status }))
    }

    if (errors) throw new Error(errors[0].message)

    if (status === 'going') {
      const { data: eventData } = await client.models.Event.get({ id: eventId })
      if (eventData) {
        await scheduleEventReminders(eventId, eventData.title, eventData.starts_at)
      }
    } else {
      await cancelEventReminders(eventId)
    }

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
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const res = await client.models.EventRsvp.list({ filter: { event_id: { eq: eventId }, user_id: { eq: user.userId } } })
    if (res.data && res.data.length > 0) {
      const { errors } = await client.models.EventRsvp.delete({ id: res.data[0].id })
      if (errors) throw new Error(errors[0].message)
    }

    await cancelEventReminders(eventId)

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
    const user = await getCurrentUser()
    if (!user) return { data: null, error: null }

    const { data: listData, errors } = await client.models.EventRsvp.list({
      filter: { event_id: { eq: eventId }, user_id: { eq: user.userId } }
    })

    if (errors) throw new Error(errors[0].message)
    return { data: listData?.[0]?.status ?? null, error: null }
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
    let filter: any = { event_id: { eq: eventId } }

    if (status) {
      filter.status = { eq: status }
    }

    const { data, errors } = await client.models.EventRsvp.list({ filter })
    if (errors) throw new Error(errors[0].message)
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
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { data, errors } = await client.models.EventRsvp.list({
      filter: { user_id: { eq: user.userId } }
    })

    if (errors) throw new Error(errors[0].message)
    const result = (data ?? []).map((row: any) => ({
      rsvp: row as EventRsvp,
      event: row.event as Event,
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
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const ext = uri.split('.').pop() ?? 'jpg'
    const path = `${user.userId}/${Date.now()}.${ext}`
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

    const publicUrl = await uploadFile('event-covers', path, uri, mimeType)
    return { data: publicUrl, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Delete event
// ---------------------------------------------------------------------------

export async function deleteEvent(eventId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { errors } = await client.models.Event.delete({ id: eventId })

    if (errors) throw new Error(errors[0].message)

    await cancelEventReminders(eventId)

    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

