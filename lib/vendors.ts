/**
 * lib/vendors.ts
 * Vendors and deals: apply, list, create listings, save deals, admin approval.
 *
 * Vendors are invisible until approved (`is_approved = true`).
 * Only the vendor owner or an admin Edge Function can flip that flag.
 * Deals are created by vendors and are only visible when their vendor is approved.
 */
import { supabase } from './supabase'
import { uploadFile } from './upload'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Vendor {
  id: string
  owner_id: string | null
  name: string
  category: string
  description: string | null
  icon: string | null
  logo_url: string | null
  location_text: string
  map_location_id: string | null
  is_approved: boolean
  is_active: boolean
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export interface VendorDeal {
  id: string
  vendor_id: string
  title: string
  description: string | null
  discount: string
  how_to_redeem: string
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  created_at: string
  vendors?: Pick<Vendor, 'id' | 'name' | 'icon' | 'logo_url' | 'location_text' | 'category'> | null
  // Client-derived
  is_saved?: boolean
}

export interface VendorWithDeals extends Vendor {
  vendor_deals: VendorDeal[]
  // Client-derived
  saved_deal_ids?: string[]
}

export interface VendorApplicationPayload {
  name: string
  category: string
  description?: string
  icon?: string
  locationText: string
  mapLocationId?: string
}

export interface CreateListingPayload {
  vendorId: string
  title: string
  description?: string
  discount: string
  howToRedeem?: string
  validFrom?: string
  validUntil?: string
}

// ---------------------------------------------------------------------------
// List vendors (approved only)
// ---------------------------------------------------------------------------

export async function getVendors(category?: string): Promise<{
  data: Vendor[] | null
  error: Error | null
}> {
  try {
    let query = supabase
      .from('vendors')
      .select('*')
      .eq('is_approved', true)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as Vendor[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Vendors with their deals
// ---------------------------------------------------------------------------

export async function getVendorsWithDeals(category?: string): Promise<{
  data: VendorWithDeals[] | null
  error: Error | null
}> {
  try {
    let query = supabase
      .from('vendors')
      .select('*, vendor_deals(*)')
      .eq('is_approved', true)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as VendorWithDeals[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Vendor detail
// ---------------------------------------------------------------------------

export async function getVendorDetail(vendorId: string): Promise<{
  data: VendorWithDeals | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('*, vendor_deals(*)')
      .eq('id', vendorId)
      .single()

    if (error) throw error
    return { data: data as VendorWithDeals, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// All active deals (across all approved vendors)
// ---------------------------------------------------------------------------

export async function getListings(category?: string): Promise<{
  data: VendorDeal[] | null
  error: Error | null
}> {
  try {
    let query = supabase
      .from('vendor_deals')
      .select('*, vendors(id, name, icon, logo_url, location_text, category)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (category) {
      query = query.eq('vendors.category', category)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as VendorDeal[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Vendor application
// ---------------------------------------------------------------------------

export async function applyAsVendor(payload: VendorApplicationPayload): Promise<{
  data: Vendor | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('vendors')
      .insert({
        owner_id: user.id,
        name: payload.name,
        category: payload.category,
        description: payload.description ?? null,
        icon: payload.icon ?? null,
        location_text: payload.locationText,
        map_location_id: payload.mapLocationId ?? null,
        is_approved: false,
      })
      .select()
      .single()

    if (error) throw error
    return { data: data as Vendor, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Create a deal listing
// ---------------------------------------------------------------------------

export async function createListing(payload: CreateListingPayload): Promise<{
  data: VendorDeal | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('vendor_deals')
      .insert({
        vendor_id: payload.vendorId,
        title: payload.title,
        description: payload.description ?? null,
        discount: payload.discount,
        how_to_redeem: payload.howToRedeem ?? 'Show FAF app',
        valid_from: payload.validFrom ?? null,
        valid_until: payload.validUntil ?? null,
      })
      .select('*, vendors(id, name, icon, logo_url, location_text, category)')
      .single()

    if (error) throw error
    return { data: data as VendorDeal, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Saved deals
// ---------------------------------------------------------------------------

export async function toggleSaveDeal(dealId: string): Promise<{
  data: { saved: boolean } | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: existing } = await supabase
      .from('saved_deals')
      .select('deal_id')
      .eq('user_id', user.id)
      .eq('deal_id', dealId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('saved_deals')
        .delete()
        .eq('user_id', user.id)
        .eq('deal_id', dealId)

      if (error) throw error
      return { data: { saved: false }, error: null }
    } else {
      const { error } = await supabase
        .from('saved_deals')
        .insert({ user_id: user.id, deal_id: dealId })

      if (error) throw error
      return { data: { saved: true }, error: null }
    }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getSavedDeals(): Promise<{
  data: VendorDeal[] | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('saved_deals')
      .select('vendor_deals(*, vendors(id, name, icon, logo_url, location_text, category))')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })

    if (error) throw error
    const deals = (data ?? [])
      .map((r: any) => r.vendor_deals)
      .filter(Boolean) as VendorDeal[]
    return { data: deals, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Returns the Set of deal IDs the current user has saved.
 * Used to hydrate the deals list with saved state.
 */
export async function getMySavedDealIds(): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()

  const { data } = await supabase
    .from('saved_deals')
    .select('deal_id')
    .eq('user_id', user.id)

  return new Set((data ?? []).map((r: { deal_id: string }) => r.deal_id))
}

// ---------------------------------------------------------------------------
// Admin: approve vendor (NOTE — use service_role client or Edge Function)
// ---------------------------------------------------------------------------

/**
 * Approves a vendor application.
 * This function will fail for regular clients because vendors RLS does not
 * allow non-owner updates. Call from admin Edge Function with service_role.
 */
export async function adminApproveVendor(vendorId: string): Promise<{
  data: Vendor | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('vendors')
      .update({
        is_approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select()
      .single()

    if (error) throw error
    return { data: data as Vendor, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Upload vendor logo
// ---------------------------------------------------------------------------

export async function uploadVendorLogo(uri: string): Promise<{
  data: string | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const ext = uri.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

    const publicUrl = await uploadFile('vendor-assets', path, uri, mimeType)
    return { data: publicUrl, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
