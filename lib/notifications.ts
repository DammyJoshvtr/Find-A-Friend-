/**
 * lib/notifications.ts
 * Notifications: fetch, mark read, mark all read, create (internal/server-side).
 *
 * INSERT into notifications is reserved for service_role (Edge Functions,
 * DB triggers) — the client can only READ and UPDATE (mark read).
 * The Zustand notificationsStore subscribes to realtime INSERT events on
 * this table and calls addNotification() directly.
 */
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'like'
  | 'comment'
  | 'repost'
  | 'follow'
  | 'connection_request'
  | 'event_rsvp'
  | 'club_announcement'
  | 'story_view'
  | 'mention'
  | 'new_message'
  | 'feedback_comment'
  | 'feedback_upvote'

export type NotificationEntityType = 'post' | 'event' | 'club' | 'story' | 'feedback' | null

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  actor_id: string | null
  entity_type: NotificationEntityType
  entity_id: string | null
  body: string | null
  is_read: boolean
  created_at: string
  // Joined
  actor?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

// ---------------------------------------------------------------------------
// Fetch notifications
// ---------------------------------------------------------------------------

export async function getNotifications(
  onlyUnread = false,
  limit = 50
): Promise<{ data: AppNotification[] | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let query = supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (onlyUnread) {
      query = query.eq('is_read', false)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as AppNotification[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  return count ?? 0
}

// ---------------------------------------------------------------------------
// Mark read
// ---------------------------------------------------------------------------

export async function markRead(notificationId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function markAllRead(): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Create notification (for use in Edge Functions / server-side only)
// Direct client INSERT will be blocked by RLS. This is provided as a
// reference signature for Edge Function code that uses service_role.
// ---------------------------------------------------------------------------

export interface CreateNotificationPayload {
  userId: string
  type: NotificationType
  actorId?: string
  entityType?: NotificationEntityType
  entityId?: string
  body?: string
}

/**
 * Creates a notification row.
 * IMPORTANT: Only works when called from a service_role context (Edge Function).
 * Regular clients cannot INSERT into notifications (RLS blocks it).
 */
export async function createNotification(
  payload: CreateNotificationPayload
): Promise<{ data: AppNotification | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: payload.userId,
        type: payload.type,
        actor_id: payload.actorId ?? null,
        entity_type: payload.entityType ?? null,
        entity_id: payload.entityId ?? null,
        body: payload.body ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return { data: data as AppNotification, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Push notification registration (unchanged from original notifications.ts)
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Skipped: not a physical device')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  console.log('[Push] Existing permission status:', existingStatus)
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
    console.log('[Push] Permission after request:', finalStatus)
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission denied — no token')
    return null
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'FAF Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#a78bfa',
    })
  }

  try {
    const { data: tokenData } = await Notifications.getExpoPushTokenAsync({
      projectId: 'c91925a9-42d3-43de-bc48-1bd279422541',
    })
    console.log('[Push] Token obtained:', tokenData)
    return tokenData ?? null
  } catch (err) {
    if (__DEV__) {
      console.warn('[Push] getExpoPushTokenAsync unavailable in dev client (Firebase not initialized). Run `eas build --profile development` with the GOOGLE_SERVICES_JSON secret to fix.', err)
    } else {
      console.error('[Push] getExpoPushTokenAsync failed:', err)
    }
    return null
  }
}

export async function savePushToken(token: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('[Push] savePushToken: no auth user')
      return
    }
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', user.id)
    if (error) console.error('[Push] savePushToken DB error:', error)
    else console.log('[Push] Token saved successfully for user:', user.id)
  } catch (error) {
    console.error('[Push] savePushToken exception:', error)
  }
}

export async function sendLocalNotification(
  title: string,
  body: string
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    })
  } catch (error) {
    console.log('Could not send notification:', error)
  }
}
