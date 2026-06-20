/**
 * lib/map.ts
 * Campus map: static named locations, dynamic event pins, vendor pins.
 *
 * Pin coordinates are stored as floats 0.0–1.0 (fraction of map image
 * dimensions). The UI component multiplies by the rendered image size to
 * get absolute pixel positions.
 */
import { client } from './aws'
import { getCurrentUser } from 'aws-amplify/auth'

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
  map_locations?: MapLocation[] | null
}

export interface VendorWithPin {
  id: string
  name: string
  category: string
  icon: string | null
  logo_url: string | null
  location_text: string
  map_location_id: string | null
  map_locations?: MapLocation[] | null
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
    const { data, errors } = await client.models.MapLocation.list({
      filter: { is_active: { eq: true } }
    })

    if (errors) throw new Error(errors[0].message)
    return { data: (data as any) as MapLocation[], error: null }
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
    // Assuming Amplify Gen 2 relations resolve mapped names
    const { data, errors } = await client.models.Event.list({
      filter: { is_public: { eq: true } }
    })

    if (errors) throw new Error(errors[0].message)
    const filtered = (data ?? []).filter(e => e.map_location_id && new Date(e.starts_at) >= new Date())
    return { data: filtered as unknown as EventWithPin[], error: null }
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
    const { data, errors } = await client.models.Vendor.list({
      filter: {
        is_approved: { eq: true },
        is_active: { eq: true }
      }
    })

    if (errors) throw new Error(errors[0].message)
    const filtered = (data ?? []).filter(v => v.map_location_id)
    return { data: filtered as unknown as VendorWithPin[], error: null }
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
    const { data, errors } = await client.models.MapLocation.create({
      name: payload.name,
      category: payload.category,
      pin_x: payload.pinX,
      pin_y: payload.pinY,
      color: payload.color ?? '#a78bfa',
      description: payload.description ?? null,
    })

    if (errors) throw new Error(errors[0].message)
    return { data: data as unknown as MapLocation, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function updateMapPin(
  pinId: string,
  updates: Partial<CreateMapPinPayload> & { isActive?: boolean }
): Promise<{ data: MapLocation | null; error: Error | null }> {
  try {
    const payload: any = { id: pinId }
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.category !== undefined) payload.category = updates.category
    if (updates.pinX !== undefined) payload.pin_x = updates.pinX
    if (updates.pinY !== undefined) payload.pin_y = updates.pinY
    if (updates.color !== undefined) payload.color = updates.color
    if (updates.description !== undefined) payload.description = updates.description
    if (updates.isActive !== undefined) payload.is_active = updates.isActive

    const { data, errors } = await client.models.MapLocation.update(payload)

    if (errors) throw new Error(errors[0].message)
    return { data: data as unknown as MapLocation, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function deleteMapPin(pinId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { errors } = await client.models.MapLocation.delete({ id: pinId })

    if (errors) throw new Error(errors[0].message)
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
  // Stubbed public S3 bucket URL format
  return 'https://findafriend-amplify-bucket.s3.amazonaws.com/public/campus-map/campus.png'
}
