/**
 * app/vendor/[id].tsx
 * Vendor detail — logo, info, active deals list.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert, Modal, TextInput, ScrollView
} from 'react-native'
import Toast from 'react-native-toast-message'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getVendorDetail, toggleSaveDeal, getMySavedDealIds, createVendorOrder, getVendorOrders, updateOrderStatus, getDealReviews, createDealReview, getMyOrders } from '../../lib/vendors'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import type { VendorWithDeals, VendorDeal } from '../../lib/vendors'
import { getTimeAgo } from '../../lib/matching'

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#fbbf24',
  Fashion: '#f472b6',
  Tech: '#60a5fa',
  Beauty: '#c084fc',
  Books: '#34d399',
  Health: '#4ade80',
  Services: '#a78bfa',
}

// ---------------------------------------------------------------------------
// Deal card
// ---------------------------------------------------------------------------

interface DealCardProps {
  deal: VendorDeal
  saved: boolean
  onToggleSave: (id: string) => void
  onOrderPress: (deal: VendorDeal) => void
  onReviewsPress: (deal: VendorDeal) => void
}

function DealCard({ deal, saved, onToggleSave, onOrderPress, onReviewsPress }: DealCardProps) {
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    onToggleSave(deal.id)
    const { error } = await toggleSaveDeal(deal.id)
    setSaving(false)
    if (error) {
      onToggleSave(deal.id) // revert on error
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not save deal.' })
    }
  }

  const isExpired = deal.valid_until ? new Date(deal.valid_until) < new Date() : false

  return (
    <View style={[s.dealCard, isExpired && s.dealCardExpired]}>
      <View style={s.discountBadge}>
        <Text style={s.discountText}>{deal.discount}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.dealTitle}>{deal.title}</Text>
        {deal.description && (
          <Text style={s.dealDesc} numberOfLines={2}>{deal.description}</Text>
        )}
        <View style={s.dealMeta}>
          <Ionicons name="information-circle-outline" size={11} color="rgba(240,240,255,0.35)" />
          <Text style={s.redeemText}>{deal.how_to_redeem}</Text>
        </View>

        <TouchableOpacity style={s.reviewsTrigger} onPress={() => onReviewsPress(deal)}>
          <Ionicons name="star" size={11} color="#fbbf24" style={{ marginRight: 4 }} />
          <Text style={s.reviewsTriggerText}>Reviews & Ratings</Text>
        </TouchableOpacity>

        {deal.valid_until && (
          <Text style={[s.validUntil, isExpired && s.expired, { marginTop: 6 }]}>
            {isExpired ? 'Expired' : `Valid until ${new Date(deal.valid_until).toLocaleDateString()}`}
          </Text>
        )}
      </View>
      <View style={{ gap: 8, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'space-between' }}>
        <TouchableOpacity
          style={s.saveBtn}
          onPress={handleSave}
          disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#fbbf24" />
            : <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={saved ? '#fbbf24' : 'rgba(240,240,255,0.4)'}
              />}
        </TouchableOpacity>

        {!isExpired && (
          <TouchableOpacity
            style={s.orderBtn}
            onPress={() => onOrderPress(deal)}>
            <Ionicons name="cart-outline" size={18} color="#000" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function VendorDetailScreen() {
  const theme = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [vendor, setVendor] = useState<VendorWithDeals | null>(null)
  const [loading, setLoading] = useState(true)
  const [savedDealIds, setSavedDealIds] = useState<Set<string>>(new Set())
  const [myUserId, setMyUserId] = useState<string | null>(null)

  // Order state
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedDealForOrder, setSelectedDealForOrder] = useState<VendorDeal | null>(null)
  const [orderQuantity, setOrderQuantity] = useState('1')
  const [orderNotes, setOrderNotes] = useState('')
  const [ordering, setOrdering] = useState(false)

  // Reviews state
  const [showReviewsModal, setShowReviewsModal] = useState(false)
  const [selectedDealForReviews, setSelectedDealForReviews] = useState<VendorDeal | null>(null)
  const [reviewsList, setReviewsList] = useState<any[]>([])
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)

  // Orders Dashboard (Owner) state
  const [showOrdersDashboard, setShowOrdersDashboard] = useState(false)
  const [vendorOrders, setVendorOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  useEffect(() => {
    if (id) loadVendor()
  }, [id])

  const loadVendor = async () => {
    setLoading(true)
    try {
      const [vendorRes, savedIds, authUserRes] = await Promise.all([
        getVendorDetail(id),
        getMySavedDealIds(),
        supabase.auth.getUser(),
      ])
      setVendor(vendorRes.data)
      setSavedDealIds(savedIds)
      if (authUserRes.data?.user) {
        setMyUserId(authUserRes.data.user.id)
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSave = (dealId: string) => {
    setSavedDealIds(prev => {
      const next = new Set(prev)
      if (next.has(dealId)) next.delete(dealId)
      else next.add(dealId)
      return next
    })
  }

  const handleOrderPress = (deal: VendorDeal) => {
    setSelectedDealForOrder(deal)
    setOrderQuantity('1')
    setOrderNotes('')
    setShowOrderModal(true)
  }

  const handlePlaceOrder = async () => {
    if (!vendor || !selectedDealForOrder) return
    const qty = parseInt(orderQuantity)
    if (isNaN(qty) || qty < 1) {
      Toast.show({ type: 'error', text1: 'Invalid quantity' })
      return
    }

    setOrdering(true)
    const { data, error } = await createVendorOrder({
      vendorId: vendor.id,
      dealId: selectedDealForOrder.id,
      quantity: qty,
      notes: orderNotes.trim() || undefined,
    })
    setOrdering(false)

    if (error) {
      Toast.show({ type: 'error', text1: 'Order failed', text2: error.message })
    } else {
      Toast.show({ type: 'success', text1: 'Order placed successfully!' })
      setShowOrderModal(false)
    }
  }

  const handleReviewsPress = async (deal: VendorDeal) => {
    setSelectedDealForReviews(deal)
    setReviewRating(5)
    setReviewComment('')
    setShowReviewsModal(true)
    loadReviews(deal.id)
  }

  const loadReviews = async (dealId: string) => {
    setReviewsLoading(true)
    const { data, error } = await getDealReviews(dealId)
    if (data) setReviewsList(data)
    setReviewsLoading(false)
  }

  const handleSubmitReview = async () => {
    if (!selectedDealForReviews) return
    if (reviewRating < 1 || reviewRating > 5) {
      Toast.show({ type: 'error', text1: 'Rating must be between 1 and 5' })
      return
    }

    setSubmittingReview(true)
    const { data, error } = await createDealReview({
      dealId: selectedDealForReviews.id,
      rating: reviewRating,
      comment: reviewComment.trim() || undefined,
    })
    setSubmittingReview(false)

    if (error) {
      Toast.show({ type: 'error', text1: 'Review failed', text2: error.message })
    } else {
      Toast.show({ type: 'success', text1: 'Review submitted successfully!' })
      setReviewComment('')
      loadReviews(selectedDealForReviews.id)
    }
  }

  const handleOpenOrdersDashboard = () => {
    if (!vendor) return
    setShowOrdersDashboard(true)
    loadVendorOrders()
  }

  const loadVendorOrders = async () => {
    if (!vendor) return
    setOrdersLoading(true)
    const isOwner = vendor.owner_id === myUserId
    if (isOwner) {
      const { data } = await getVendorOrders(vendor.id)
      if (data) setVendorOrders(data)
    } else {
      const { data } = await getMyOrders()
      if (data) {
        const filtered = data.filter((o: any) => o.vendor_id === vendor.id)
        setVendorOrders(filtered)
      }
    }
    setOrdersLoading(false)
  }

  const handleUpdateOrderStatus = async (orderId: string, status: 'pending' | 'accepted' | 'completed' | 'cancelled') => {
    const { error } = await updateOrderStatus(orderId, status)
    if (error) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: error.message })
    } else {
      Toast.show({ type: 'success', text1: `Order ${status}` })
      loadVendorOrders()
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <ActivityIndicator size="large" color="#fbbf24" />
        </View>
      </SafeAreaView>
    )
  }

  if (!vendor) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <Text style={s.errorText}>Vendor not found</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => router.back()}>
            <Text style={s.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const accentColor = CATEGORY_COLORS[vendor.category] ?? '#fbbf24'
  const activeDeals = vendor.vendor_deals?.filter(d => d.is_active) ?? []

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <FlatList
        data={activeDeals}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            saved={savedDealIds.has(item.id)}
            onToggleSave={handleToggleSave}
            onOrderPress={handleOrderPress}
            onReviewsPress={handleReviewsPress}
          />
        )}
        ListHeaderComponent={
          <>
            {/* Back button */}
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            {/* Vendor hero */}
            <View style={[s.hero, { backgroundColor: accentColor + '18' }]}>
              {vendor.cover_url && (
                <Image source={{ uri: vendor.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              )}
              {vendor.cover_url && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
              )}
              {vendor.logo_url ? (
                <Image source={{ uri: vendor.logo_url }} style={[s.heroLogo, vendor.cover_url ? { borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' } : {}]} resizeMode="contain" />
              ) : (
                <Text style={s.heroEmoji}>{vendor.icon ?? '🏪'}</Text>
              )}
            </View>

            {/* Info */}
            <View style={s.infoSection}>
              <View style={s.infoHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.vendorName}>{vendor.name}</Text>
                  <View style={s.metaRow}>
                    <Text style={[s.categoryBadge, { color: accentColor }]}>{vendor.category}</Text>
                    <Text style={s.sep}>·</Text>
                    <Ionicons name="location-outline" size={12} color="rgba(240,240,255,0.4)" />
                    <Text style={s.location}>{vendor.location_text}</Text>
                  </View>
                </View>
                <View style={[s.dealCountBadge, { backgroundColor: accentColor + '22' }]}>
                  <Ionicons name="pricetag-outline" size={12} color={accentColor} />
                  <Text style={[s.dealCountText, { color: accentColor }]}>
                    {activeDeals.length} deals
                  </Text>
                </View>
              </View>

              {vendor.description && (
                <Text style={s.description}>{vendor.description}</Text>
              )}

              {/* Interaction Buttons Row */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                {vendor.owner_id && vendor.owner_id !== myUserId && (
                  <TouchableOpacity
                    style={[s.interactionBtn, { borderColor: theme.border, borderWidth: 1 }]}
                    onPress={() => router.push(`/chat/${vendor.owner_id}` as any)}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.text} style={{ marginRight: 6 }} />
                    <Text style={[s.interactionBtnText, { color: theme.text }]}>Chat with Vendor</Text>
                  </TouchableOpacity>
                )}

                {vendor.owner_id === myUserId ? (
                  <TouchableOpacity
                    style={[s.interactionBtn, { backgroundColor: 'rgba(251,191,36,0.15)', borderColor: '#fbbf24', borderWidth: 0.5 }]}
                    onPress={handleOpenOrdersDashboard}>
                    <Ionicons name="receipt-outline" size={16} color="#fbbf24" style={{ marginRight: 6 }} />
                    <Text style={[s.interactionBtnText, { color: '#fbbf24' }]}>Orders Dashboard</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[s.interactionBtn, { borderColor: theme.border, borderWidth: 1 }]}
                    onPress={() => {
                      setShowOrdersDashboard(true)
                      loadVendorOrders()
                    }}>
                    <Ionicons name="receipt-outline" size={16} color={theme.text} style={{ marginRight: 6 }} />
                    <Text style={[s.interactionBtnText, { color: theme.text }]}>My Orders</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <Text style={s.sectionTitle}>Active Deals</Text>
          </>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="pricetag-outline" size={36} color="rgba(240,240,255,0.1)" />
            <Text style={s.emptyText}>No active deals right now</Text>
            <Text style={s.emptySub}>Check back soon for student discounts</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Place Order Modal ── */}
      <Modal visible={showOrderModal} transparent animationType="slide" onRequestClose={() => setShowOrderModal(false)}>
        <View style={s.modalContainer}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowOrderModal(false)} />
          <View style={[s.modalSheet, { backgroundColor: theme.cardSolid || theme.card2, borderColor: theme.border }]}>
            <View style={[s.modalHandle, { backgroundColor: theme.border2 }]} />
            <Text style={[s.modalTitle, { color: theme.text }]}>Place Order</Text>
            {selectedDealForOrder && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: theme.text, fontSize: 16, fontFamily: typography.fontBold }}>{selectedDealForOrder.title}</Text>
                <Text style={{ color: '#fbbf24', fontSize: 14, fontFamily: typography.fontSemiBold, marginTop: 4 }}>{selectedDealForOrder.discount} Off</Text>
              </View>
            )}

            <Text style={{ color: theme.textMuted, fontSize: 12, fontFamily: typography.fontBold, textTransform: 'uppercase', marginBottom: 8 }}>Quantity</Text>
            <TextInput
              style={[s.editInput, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text }]}
              keyboardType="numeric"
              value={orderQuantity}
              onChangeText={setOrderQuantity}
              placeholder="1"
              placeholderTextColor={theme.textFaint}
            />

            <Text style={{ color: theme.textMuted, fontSize: 12, fontFamily: typography.fontBold, textTransform: 'uppercase', marginBottom: 8, marginTop: 8 }}>Notes / Preferences</Text>
            <TextInput
              style={[s.editInput, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text, height: 80 }]}
              multiline
              numberOfLines={3}
              value={orderNotes}
              onChangeText={setOrderNotes}
              placeholder="e.g. No onions, extra cheese, pick up at 5 PM..."
              placeholderTextColor={theme.textFaint}
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}
                onPress={() => setShowOrderModal(false)}>
                <Text style={{ color: theme.text, fontFamily: typography.fontBold }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#fbbf24', alignItems: 'center', justifyContent: 'center' }}
                onPress={handlePlaceOrder}
                disabled={ordering}>
                {ordering ? <ActivityIndicator size="small" color="#000" /> : <Text style={{ color: '#000', fontFamily: typography.fontBold }}>Confirm Order</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reviews Modal ── */}
      <Modal visible={showReviewsModal} transparent animationType="slide" onRequestClose={() => setShowReviewsModal(false)}>
        <View style={s.modalContainer}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowReviewsModal(false)} />
          <View style={[s.modalSheet, { backgroundColor: theme.cardSolid || theme.card2, borderColor: theme.border, maxHeight: '85%' }]}>
            <View style={[s.modalHandle, { backgroundColor: theme.border2 }]} />
            <Text style={[s.modalTitle, { color: theme.text, marginBottom: 8 }]}>Reviews & Ratings</Text>

            {reviewsLoading ? (
              <ActivityIndicator color="#fbbf24" style={{ marginVertical: 32 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Write Review Form (Only for non-owners) */}
                {vendor.owner_id !== myUserId && (
                  <View style={{ borderBottomWidth: 0.5, borderColor: theme.border, paddingBottom: 16, marginBottom: 16 }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontFamily: typography.fontSemiBold, marginBottom: 8 }}>Write a Review</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                          <Ionicons
                            name={star <= reviewRating ? 'star' : 'star-outline'}
                            size={24}
                            color="#fbbf24"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={[s.editInput, { backgroundColor: theme.card2, borderColor: theme.border, color: theme.text, height: 60 }]}
                      multiline
                      value={reviewComment}
                      onChangeText={setReviewComment}
                      placeholder="Share your experience..."
                      placeholderTextColor={theme.textFaint}
                    />
                    <TouchableOpacity
                      style={{ backgroundColor: '#fbbf24', borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
                      onPress={handleSubmitReview}
                      disabled={submittingReview}>
                      {submittingReview ? <ActivityIndicator size="small" color="#000" /> : <Text style={{ color: '#000', fontFamily: typography.fontBold, fontSize: 12 }}>Submit Review</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Reviews List */}
                <Text style={{ color: theme.textMuted, fontSize: 11, fontFamily: typography.fontBold, textTransform: 'uppercase', marginBottom: 12 }}>Student Reviews ({reviewsList.length})</Text>
                {reviewsList.length === 0 ? (
                  <Text style={{ color: theme.textFaint, fontSize: 13, textAlign: 'center', marginVertical: 16 }}>No reviews yet. Be the first to review!</Text>
                ) : (
                  reviewsList.map(item => (
                    <View key={item.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: 0.5, borderColor: theme.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ color: theme.text, fontSize: 13, fontFamily: typography.fontBold }}>{item.profiles?.full_name || 'Anonymous'}</Text>
                        <Text style={{ color: theme.textFaint, fontSize: 10 }}>{new Date(item.created_at).toLocaleDateString()}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 2, marginBottom: 4 }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Ionicons
                            key={star}
                            name={star <= item.rating ? 'star' : 'star-outline'}
                            size={10}
                            color="#fbbf24"
                          />
                        ))}
                      </View>
                      {item.comment && (
                        <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 16 }}>{item.comment}</Text>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={[s.closeBtn, { marginTop: 16 }]} onPress={() => setShowReviewsModal(false)}>
              <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Orders Dashboard Modal ── */}
      <Modal visible={showOrdersDashboard} transparent animationType="slide" onRequestClose={() => setShowOrdersDashboard(false)}>
        <View style={s.modalContainer}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowOrdersDashboard(false)} />
          <View style={[s.modalSheet, { backgroundColor: theme.cardSolid || theme.card2, borderColor: theme.border, maxHeight: '85%' }]}>
            <View style={[s.modalHandle, { backgroundColor: theme.border2 }]} />
            <Text style={[s.modalTitle, { color: theme.text, marginBottom: 12 }]}>
              {vendor.owner_id === myUserId ? 'Orders Dashboard' : 'My Orders'}
            </Text>

            {ordersLoading ? (
              <ActivityIndicator color="#fbbf24" style={{ marginVertical: 32 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {vendorOrders.length === 0 ? (
                  <Text style={{ color: theme.textFaint, fontSize: 13, textAlign: 'center', marginVertical: 32 }}>No orders placed yet.</Text>
                ) : (
                  vendorOrders.map(item => {
                    const statusColors = {
                      pending: '#fbbf24',
                      accepted: '#60a5fa',
                      completed: '#4ade80',
                      cancelled: '#f87171',
                    }
                    const statusColor = statusColors[item.status as keyof typeof statusColors] || '#64748b'
                    const isMerchant = vendor.owner_id === myUserId

                    return (
                      <View key={item.id} style={{ marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 0.5, borderColor: theme.border, backgroundColor: theme.card2 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={{ color: theme.text, fontSize: 13, fontFamily: typography.fontBold }}>
                            {item.vendor_deals?.title || 'Custom Order'}
                          </Text>
                          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: statusColor + '15', borderWidth: 0.5, borderColor: statusColor + '30' }}>
                            <Text style={{ color: statusColor, fontSize: 9, fontFamily: typography.fontBold, textTransform: 'uppercase' }}>{item.status}</Text>
                          </View>
                        </View>
                        <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 4 }}>
                          Quantity: {item.quantity} · Placed {getTimeAgo(item.created_at)}
                        </Text>
                        {isMerchant && (
                          <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 4 }}>
                            Customer: {item.profiles?.full_name || 'Student'}
                          </Text>
                        )}
                        {item.notes && (
                          <Text style={{ color: theme.textFaint, fontSize: 11, fontStyle: 'italic', backgroundColor: theme.card, padding: 6, borderRadius: 6, marginTop: 4 }}>
                            Note: {item.notes}
                          </Text>
                        )}

                        {/* Status Action Buttons (Only for Merchant) */}
                        {isMerchant && item.status !== 'completed' && item.status !== 'cancelled' && (
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                            {item.status === 'pending' && (
                              <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(96,165,250,0.15)', borderWidth: 0.5, borderColor: '#60a5fa', alignItems: 'center' }}
                                onPress={() => handleUpdateOrderStatus(item.id, 'accepted')}>
                                <Text style={{ color: '#60a5fa', fontSize: 11, fontFamily: typography.fontBold }}>Accept</Text>
                              </TouchableOpacity>
                            )}
                            {item.status === 'accepted' && (
                              <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 0.5, borderColor: '#4ade80', alignItems: 'center' }}
                                onPress={() => handleUpdateOrderStatus(item.id, 'completed')}>
                                <Text style={{ color: '#4ade80', fontSize: 11, fontFamily: typography.fontBold }}>Complete</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={{ flex: 1, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.15)', borderWidth: 0.5, borderColor: '#f87171', alignItems: 'center' }}
                              onPress={() => handleUpdateOrderStatus(item.id, 'cancelled')}>
                              <Text style={{ color: '#f87171', fontSize: 11, fontFamily: typography.fontBold }}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )
                  })
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={[s.closeBtn, { marginTop: 16 }]} onPress={() => setShowOrdersDashboard(false)}>
              <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centeredWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  retryBtn: { backgroundColor: '#fbbf24', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13, fontFamily: typography.fontSemiBold, color: '#000' },
  backBtn: {
    position: 'absolute', top: 48, left: 16, zIndex: 10,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  hero: { width: '100%', height: 200, alignItems: 'center', justifyContent: 'center' },
  heroLogo: { width: 120, height: 120, borderRadius: 20 },
  heroEmoji: { fontSize: 64 },
  infoSection: { paddingHorizontal: 16, paddingVertical: 16 },
  infoHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  vendorName: { fontSize: 22, fontFamily: typography.fontBold, color: '#f0f0ff', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryBadge: { fontSize: 12, fontFamily: typography.fontSemiBold },
  sep: { fontSize: 12, color: 'rgba(240,240,255,0.2)' },
  location: { fontSize: 12, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontRegular },
  dealCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  dealCountText: { fontSize: 12, fontFamily: typography.fontSemiBold },
  description: {
    fontSize: 13, color: 'rgba(240,240,255,0.6)', lineHeight: 20, fontFamily: typography.fontRegular,
  },
  sectionTitle: {
    fontSize: 13, fontFamily: typography.fontSemiBold, color: 'rgba(240,240,255,0.5)',
    paddingHorizontal: 16, marginBottom: 10,
  },
  // Deal card
  dealCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#1c1c2e', borderRadius: 14, padding: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  dealCardExpired: { opacity: 0.5 },
  discountBadge: {
    backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.3)',
    alignSelf: 'flex-start',
  },
  discountText: { fontSize: 13, fontFamily: typography.fontBold, color: '#fbbf24' },
  dealTitle: { fontSize: 14, fontFamily: typography.fontSemiBold, color: '#f0f0ff', marginBottom: 4 },
  dealDesc: { fontSize: 12, color: 'rgba(240,240,255,0.5)', lineHeight: 17, marginBottom: 6, fontFamily: typography.fontRegular },
  dealMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  redeemText: { fontSize: 11, color: 'rgba(240,240,255,0.4)', flex: 1, fontFamily: typography.fontMedium },
  validUntil: { fontSize: 10, color: 'rgba(240,240,255,0.35)', fontFamily: typography.fontRegular },
  expired: { color: 'rgba(239,68,68,0.6)' },
  saveBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontRegular },
  emptySub: { fontSize: 12, color: 'rgba(240,240,255,0.25)', fontFamily: typography.fontRegular },
  reviewsTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  reviewsTriggerText: {
    fontSize: 12,
    fontFamily: typography.fontMedium,
    color: '#fbbf24',
    marginLeft: 4,
    textDecorationLine: 'underline',
  },
  orderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interactionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  interactionBtnText: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderWidth: 0.5,
    borderBottomWidth: 0,
    maxHeight: '85%',
    width: '100%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: typography.fontBold,
    marginBottom: 18,
  },
  closeBtn: {
    backgroundColor: 'rgba(240,240,255,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: typography.fontRegular,
    borderWidth: 0.5,
  },
})
