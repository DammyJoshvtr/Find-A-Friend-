/**
 * lib/vendors.ts
 * Vendors and deals: apply, list, create listings, save deals, admin approval.
 *
 * Vendors are invisible until approved (`is_approved = true`).
 * Only the vendor owner or an admin Edge Function can flip that flag.
 * Deals are created by vendors and are only visible when their vendor is approved.
import { client } from './aws'
import { getCurrentUser } from 'aws-amplify/auth'
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
  cover_url: string | null
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
  cover_url?: string
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
    const filter: any = { is_approved: { eq: true }, is_active: { eq: true } }
    if (category) filter.category = { eq: category }
    const { data, errors } = await client.models.Vendor.list({ filter })
    if (errors) throw errors[0]
    return { data: data as unknown as Vendor[], error: null }
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
    const filter: any = { is_approved: { eq: true }, is_active: { eq: true } }
    if (category) filter.category = { eq: category }
    const { data, errors } = await client.models.Vendor.list({ filter })
    if (errors) throw errors[0]
    const withDeals = await Promise.all(data.map(async (v: any) => {
      const deals = await v.vendor_deals()
      return { ...v, vendor_deals: deals.data }
    }))
    return { data: withDeals as unknown as VendorWithDeals[], error: null }
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
    const { data, errors } = await client.models.Vendor.get({ id: vendorId })
    if (errors) throw errors[0]
    if (!data) throw new Error('Not found')
    const deals = await (data as any).vendor_deals()
    return { data: { ...data, vendor_deals: deals.data } as unknown as VendorWithDeals, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// My vendor detail
// ---------------------------------------------------------------------------

export async function getMyVendor(): Promise<{
  data: VendorWithDeals | null
  error: Error | null
}> {
  try {
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    const { data, errors } = await client.models.Vendor.list({ filter: { owner_id: { eq: user.id } } })
    if (errors) throw errors[0]
    if (!data || data.length === 0) return { data: null, error: null }
    const vendor = data[0]
    const deals = await (vendor as any).vendor_deals()
    return { data: { ...vendor, vendor_deals: deals.data } as unknown as VendorWithDeals, error: null }
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
    let vendorIds: string[] | null = null

    if (category) {
      const { data: vendorRows, errors: vError } = await client.models.Vendor.list({
        filter: { is_approved: { eq: true }, is_active: { eq: true }, category: { eq: category } }
      })
      if (vError) throw vError[0]
      vendorIds = (vendorRows ?? []).map((v: any) => v.id)
      if (!vendorIds.length) return { data: [], error: null }
    }

    const filter: any = { is_active: { eq: true } }
    if (vendorIds) filter.vendor_id = { in: vendorIds }

    const { data, errors } = await client.models.VendorDeal.list({ filter })
    if (errors) throw errors[0]
    
    const withVendors = await Promise.all(data.map(async (d: any) => {
      const v = await d.vendors()
      return { ...d, vendors: v.data }
    }))
    return { data: withVendors as unknown as VendorDeal[], error: null }
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
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    const insertData: any = {
      owner_id: user.id,
      name: payload.name,
      category: payload.category,
      description: payload.description ?? null,
      icon: payload.icon ?? null,
      location_text: payload.locationText,
      map_location_id: payload.mapLocationId ?? null,
      is_approved: false,
    }

    if (payload.cover_url !== undefined) {
      insertData.cover_url = payload.cover_url
    }

    const { data, errors } = await client.models.Vendor.create(insertData)
    if (errors) throw errors[0]
    return { data: data as unknown as Vendor, error: null }
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
    const { data, errors } = await client.models.VendorDeal.create({
      vendor_id: payload.vendorId,
      title: payload.title,
      description: payload.description ?? null,
      discount: payload.discount,
      how_to_redeem: payload.howToRedeem ?? 'Show FAF app',
      valid_from: payload.validFrom ?? null,
      valid_until: payload.validUntil ?? null,
    })
    if (errors) throw errors[0]
    const v = await (data as any).vendors()
    return { data: { ...data, vendors: v.data } as unknown as VendorDeal, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Update a deal listing
// ---------------------------------------------------------------------------

export async function updateDeal(dealId: string, payload: Partial<CreateListingPayload>): Promise<{
  data: VendorDeal | null
  error: Error | null
}> {
  try {
    const updateData: any = { id: dealId }
    if (payload.title !== undefined) updateData.title = payload.title
    if (payload.description !== undefined) updateData.description = payload.description
    if (payload.discount !== undefined) updateData.discount = payload.discount
    if (payload.howToRedeem !== undefined) updateData.how_to_redeem = payload.howToRedeem
    if (payload.validFrom !== undefined) updateData.valid_from = payload.validFrom
    if (payload.validUntil !== undefined) updateData.valid_until = payload.validUntil

    const { data, errors } = await client.models.VendorDeal.update(updateData)
    if (errors) throw errors[0]
    return { data: data as unknown as VendorDeal, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Delete a deal listing
// ---------------------------------------------------------------------------

export async function deleteDeal(dealId: string): Promise<{
  data: boolean
  error: Error | null
}> {
  try {
    const { errors } = await client.models.VendorDeal.delete({ id: dealId })
    if (errors) throw errors[0]
    return { data: true, error: null }
  } catch (err) {
    return { data: false, error: err as Error }
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
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    const { data: existingData } = await client.models.SavedDeal.list({
      filter: { user_id: { eq: user.id }, deal_id: { eq: dealId } }
    })
    const existing = existingData && existingData.length > 0 ? existingData[0] : null

    if (existing) {
      const { errors } = await client.models.SavedDeal.delete({ id: existing.id })
      if (errors) throw errors[0]
      return { data: { saved: false }, error: null }
    } else {
      const { errors } = await client.models.SavedDeal.create({ user_id: user.id, deal_id: dealId })
      if (errors) throw errors[0]
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
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    const { data, errors } = await client.models.SavedDeal.list({
      filter: { user_id: { eq: user.id } }
    })
    if (errors) throw errors[0]
    
    const deals = await Promise.all((data ?? []).map(async (r: any) => {
      const dealRes = await r.vendor_deals()
      if (!dealRes.data) return null
      const vRes = await dealRes.data.vendors()
      return { ...dealRes.data, vendors: vRes.data }
    }))
    return { data: deals.filter(Boolean) as unknown as VendorDeal[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Returns the Set of deal IDs the current user has saved.
 * Used to hydrate the deals list with saved state.
 */
export async function getMySavedDealIds(): Promise<Set<string>> {
  try {
    const authUser = await getCurrentUser()
    if (!authUser) return new Set()
    const user = { id: authUser.userId }

    const { data } = await client.models.SavedDeal.list({
      filter: { user_id: { eq: user.id } }
    })

    return new Set((data ?? []).map((r: any) => r.deal_id))
  } catch {
    return new Set()
  }
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
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    const { data, errors } = await client.models.Vendor.update({
      id: vendorId,
      is_approved: true,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })

    if (errors) throw errors[0]
    return { data: data as unknown as Vendor, error: null }
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
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    const ext = uri.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

    const publicUrl = await uploadFile('vendor-assets', path, uri, mimeType)
    return { data: publicUrl, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Upload vendor cover
// ---------------------------------------------------------------------------

export async function uploadVendorCover(uri: string): Promise<{
  data: string | null
  error: Error | null
}> {
  try {
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    const ext = uri.split('.').pop() ?? 'jpg'
    const path = `${user.id}/cover_${Date.now()}.${ext}`
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

    const publicUrl = await uploadFile('vendor-assets', path, uri, mimeType)
    return { data: publicUrl, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Vendor Orders & Deal Reviews
// ---------------------------------------------------------------------------

export interface VendorOrder {
  id: string
  vendor_id: string
  user_id: string
  deal_id: string | null
  quantity: number
  notes: string | null
  status: 'pending' | 'accepted' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  vendor_deals?: { title: string; discount: string } | null
  vendors?: { name: string; icon: string | null; logo_url: string | null } | null
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

export interface DealReview {
  id: string
  deal_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

export async function createVendorOrder(payload: {
  vendorId: string
  dealId?: string
  quantity: number
  notes?: string
}): Promise<{ data: VendorOrder | null; error: Error | null }> {
  try {
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    const { data, errors } = await client.models.VendorOrder.create({
      vendor_id: payload.vendorId,
      user_id: user.id,
      deal_id: payload.dealId ?? null,
      quantity: payload.quantity,
      notes: payload.notes ?? null,
      status: 'pending',
    })

    if (errors) throw errors[0]
    const deal = await (data as any).vendor_deals()
    const vendor = await (data as any).vendors()
    return { data: { ...data, vendor_deals: deal?.data, vendors: vendor?.data } as any, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getMyOrders(): Promise<{ data: VendorOrder[] | null; error: Error | null }> {
  try {
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    const { data, errors } = await client.models.VendorOrder.list({ filter: { user_id: { eq: user.id } } })
    if (errors) throw errors[0]
    
    const enriched = await Promise.all(data.map(async (o: any) => {
      const deal = await o.vendor_deals()
      const vendor = await o.vendors()
      return { ...o, vendor_deals: deal?.data, vendors: vendor?.data }
    }))
    return { data: enriched as any[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getVendorOrders(vendorId: string): Promise<{ data: VendorOrder[] | null; error: Error | null }> {
  try {
    const { data, errors } = await client.models.VendorOrder.list({ filter: { vendor_id: { eq: vendorId } } })
    if (errors) throw errors[0]
    
    const enriched = await Promise.all(data.map(async (o: any) => {
      const deal = await o.vendor_deals()
      const profile = await o.profiles()
      return { ...o, vendor_deals: deal?.data, profiles: profile?.data }
    }))
    return { data: enriched as any[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function updateOrderStatus(orderId: string, status: 'pending' | 'accepted' | 'completed' | 'cancelled'): Promise<{ error: Error | null }> {
  try {
    const { errors } = await client.models.VendorOrder.update({ id: orderId, status, updated_at: new Date().toISOString() })
    if (errors) throw errors[0]
    return { error: null }
  } catch (err) {
    return { error: err as Error }
  }
}

export async function getDealReviews(dealId: string): Promise<{ data: DealReview[] | null; error: Error | null }> {
  try {
    const { data, errors } = await client.models.DealReview.list({ filter: { deal_id: { eq: dealId } } })
    if (errors) throw errors[0]
    
    const enriched = await Promise.all(data.map(async (r: any) => {
      const profile = await r.profiles()
      return { ...r, profiles: profile?.data }
    }))
    return { data: enriched as any[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function createDealReview(payload: {
  dealId: string
  rating: number
  comment?: string
}): Promise<{ data: DealReview | null; error: Error | null }> {
  try {
    const authUser = await getCurrentUser()
    if (!authUser) throw new Error('Not authenticated')
    const user = { id: authUser.userId }

    const { data, errors } = await client.models.DealReview.create({
      deal_id: payload.dealId,
      user_id: user.id,
      rating: payload.rating,
      comment: payload.comment ?? null,
    })

    if (errors) throw errors[0]
    const profile = await (data as any).profiles()
    return { data: { ...data, profiles: profile?.data } as any, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
