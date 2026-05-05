/**
 * lib/map.ts
 * Campus map: static named locations, dynamic event pins, vendor pins.
 *
 * Pin coordinates are stored as floats 0.0–1.0 (fraction of map image
 * dimensions). The UI component multiplies by the rendered image size to
 * get absolute pixel positions.
 */
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MapPinCategory = 'building' | 'vendor' | 'event_venue' | 'landmark'

export interface MapLocation {
  id: string
  name: string
  category: MapPinCategory
  pin_x: number
  pin_y: number
  color: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface EventWithPin {
  id: string
  title: string
  venue: string | null
  starts_at: string
  ends_at: string | null
  category: string | null
  cover_image_url: string | null
  rsvp_count: number
  map_location_id: string | null
  map_pin_x: number | null
  map_pin_y: number | null
  map_locations?: MapLocation | null
}

export interface VendorWithPin {
  id: string
  name: string
  category: string
  icon: string | null
  logo_url: string | null
  location_text: string
  map_location_id: string | null
  map_locations?: MapLocation | null
}

export interface MapPin {
  id: string
  name: string
  category: MapPinCategory
  pin_x: number
  pin_y: number
  color: string
  description?: string | null
  is_active?: boolean
}

export interface CreateMapPinPayload {
  name: string
  category: MapPinCategory
  pinX: number
  pinY: number
  color?: string
  description?: string
}

// ---------------------------------------------------------------------------
// Fetch all active map locations
// ---------------------------------------------------------------------------

export async function getMapPins(): Promise<{
  data: MapLocation[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('map_locations')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error
    return { data: data as MapLocation[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Fetch upcoming events that have map coordinates
// ---------------------------------------------------------------------------

export async function getMapEvents(): Promise<{
  data: EventWithPin[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, venue, starts_at, ends_at, category, cover_image_url, rsvp_count, map_location_id, map_pin_x, map_pin_y, map_locations(*)')
      .eq('is_public', true)
      .gte('starts_at', new Date().toISOString())
      .not('map_location_id', 'is', null)
      .order('starts_at', { ascending: true })

    if (error) throw error
    return { data: data as EventWithPin[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Fetch approved vendors that have map locations
// ---------------------------------------------------------------------------

export async function getMapVendors(): Promise<{
  data: VendorWithPin[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('id, name, category, icon, logo_url, location_text, map_location_id, map_locations(*)')
      .eq('is_approved', true)
      .eq('is_active', true)
      .not('map_location_id', 'is', null)

    if (error) throw error
    return { data: data as VendorWithPin[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Admin: create / update / delete map pins
// These operations are gated by service_role on the server side. Calling
// them from the client requires the user to have role = 'admin'.
// ---------------------------------------------------------------------------

export async function createMapPin(payload: CreateMapPinPayload): Promise<{
  data: MapLocation | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('map_locations')
      .insert({
        name: payload.name,
        category: payload.category,
        pin_x: payload.pinX,
        pin_y: payload.pinY,
        color: payload.color ?? '#a78bfa',
        description: payload.description ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return { data: data as MapLocation, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function updateMapPin(
  pinId: string,
  updates: Partial<CreateMapPinPayload> & { isActive?: boolean }
): Promise<{ data: MapLocation | null; error: Error | null }> {
  try {
    const payload: Record<string, unknown> = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.category !== undefined) payload.category = updates.category
    if (updates.pinX !== undefined) payload.pin_x = updates.pinX
    if (updates.pinY !== undefined) payload.pin_y = updates.pinY
    if (updates.color !== undefined) payload.color = updates.color
    if (updates.description !== undefined) payload.description = updates.description
    if (updates.isActive !== undefined) payload.is_active = updates.isActive

    const { data, error } = await supabase
      .from('map_locations')
      .update(payload)
      .eq('id', pinId)
      .select()
      .single()

    if (error) throw error
    return { data: data as MapLocation, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function deleteMapPin(pinId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { error } = await supabase
      .from('map_locations')
      .delete()
      .eq('id', pinId)

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Campus map image URL (from campus-map storage bucket)
// ---------------------------------------------------------------------------

/**
 * Returns the public URL for the campus map image.
 * The file is expected to be uploaded by admin as `campus.png`.
 */
export function getCampusMapUrl(): string {
  const { data } = supabase.storage.from('campus-map').getPublicUrl('campus.png')
  return data.publicUrl
}
