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
import { client } from './aws'
import { getCurrentUser } from 'aws-amplify/auth'
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
  | 'comment_reply'

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
    const currentUser = await getCurrentUser()
    const user = { id: currentUser.userId }
    if (!user) throw new Error('Not authenticated')

    let filter: any = { user_id: { eq: user.id } }
    if (onlyUnread) {
      filter.is_read = { eq: false }
    }

    const { data, errors } = await client.models.Notification.list({
      filter,
      limit
    })
    if (errors) throw errors[0]
    return { data: data as unknown as AppNotification[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getUnreadCount(): Promise<number> {
  let user;
  try {
    const currentUser = await getCurrentUser()
    user = { id: currentUser.userId }
  } catch (e) {
    return 0
  }

  const { data } = await client.models.Notification.list({
    filter: { user_id: { eq: user.id }, is_read: { eq: false } }
  })

  return data.length
}

// ---------------------------------------------------------------------------
// Mark read
// ---------------------------------------------------------------------------

export async function markRead(notificationId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { errors } = await client.models.Notification.update({ id: notificationId, is_read: true })
    const error = errors ? errors[0] : null

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
    const currentUser = await getCurrentUser()
    const user = { id: currentUser.userId }
    if (!user) throw new Error('Not authenticated')

    const { data: toUpdate } = await client.models.Notification.list({
      filter: { user_id: { eq: user.id }, is_read: { eq: false } }
    })
    for (const item of toUpdate) {
      await client.models.Notification.update({ id: item.id, is_read: true })
    }
    const error = null

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function deleteAllNotifications(): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const currentUser = await getCurrentUser()
    const user = { id: currentUser.userId }
    if (!user) throw new Error('Not authenticated')

    const { data: toDelete } = await client.models.Notification.list({
      filter: { user_id: { eq: user.id } }
    })
    for (const item of toDelete) {
      await client.models.Notification.delete({ id: item.id })
    }
    const error = null

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
    const { data, errors } = await client.models.Notification.create({
      user_id: payload.userId,
      type: payload.type,
      actor_id: payload.actorId ?? null,
      entity_type: payload.entityType ?? null,
      entity_id: payload.entityId ?? null,
      body: payload.body ?? null,
    })
    const error = errors ? errors[0] : null

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
    shouldSetBadge: true,
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
    let user;
    try {
      const currentUser = await getCurrentUser()
      user = { id: currentUser.userId }
    } catch (e) {
      console.log('[Push] savePushToken: no auth user')
      return
    }
    const { errors } = await client.models.Profile.update({ id: user.id, push_token: token })
    const error = errors ? errors[0] : null
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

export async function scheduleEventReminders(
  eventId: string,
  title: string,
  startsAt: string
): Promise<void> {
  try {
    const startDate = new Date(startsAt)
    if (isNaN(startDate.getTime())) return

    // 1 week before
    const weekBefore = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    if (weekBefore > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `event-${eventId}-week`,
        content: {
          title: 'Upcoming Event 🗓️',
          body: `${title} is coming up in exactly one week!`,
          data: { route: `/event/${eventId}` },
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: weekBefore },
      })
    }

    // 1 day before
    const dayBefore = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
    if (dayBefore > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `event-${eventId}-day`,
        content: {
          title: 'Event Tomorrow!',
          body: `Don't forget, ${title} is happening tomorrow!`,
          data: { route: `/event/${eventId}` },
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dayBefore },
      })
    }

    // 1 hour before
    const hourBefore = new Date(startDate.getTime() - 60 * 60 * 1000)
    if (hourBefore > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `event-${eventId}-hour`,
        content: {
          title: 'Starting soon ⏳',
          body: `${title} starts in one hour. Get ready!`,
          data: { route: `/event/${eventId}` },
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: hourBefore },
      })
    }

    console.log(`[Notifications] Reminders scheduled for event ${eventId}`)
  } catch (error) {
    console.log('[Notifications] Could not schedule event reminders:', error)
  }
}

export async function cancelEventReminders(eventId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`event-${eventId}-week`)
    await Notifications.cancelScheduledNotificationAsync(`event-${eventId}-day`)
    await Notifications.cancelScheduledNotificationAsync(`event-${eventId}-hour`)
    console.log(`[Notifications] Reminders cancelled for event ${eventId}`)
  } catch (error) {
    console.log('[Notifications] Could not cancel event reminders:', error)
  }
}

// ---------------------------------------------------------------------------
// Web Push Notifications
// ---------------------------------------------------------------------------

export async function subscribeToWebPush(userId: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[WebPush] Service Worker or PushManager not supported')
      return
    }

    // iOS Safari requires the service worker to be fully active before subscribing
    const reg = await navigator.serviceWorker.ready
    if (!reg.active) {
      console.log('[WebPush] Service worker not yet active, skipping')
      return
    }

    // Check existing permission without prompting (prompting must come from a user gesture on iOS)
    const existingPermission = Notification.permission
    if (existingPermission === 'denied') {
      console.log('[WebPush] Notification permission denied')
      return
    }

    // Only request permission if not already granted.
    // On iOS, this call MUST originate from a user gesture (tap).
    // When called from useEffect (auto), iOS silently ignores it.
    // We still try here for Android/desktop; iOS users must tap a prompt.
    if (existingPermission !== 'granted') {
      const granted = await Notification.requestPermission()
      if (granted !== 'granted') {
        console.log('[WebPush] Permission not granted:', granted)
        return
      }
    }

    // VAPID public key — hardcoded as fallback because process.env values
    // are statically inlined at Metro build time; they resolve to undefined
    // when accessed dynamically at runtime on the web target.
    const vapidKey =
      process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ||
      'BMW-cNs21tNNic2idPQjGlKXCMPtk_sgzd-K5zbrlM6ftDQlBJJB7FJcBx_lsE8fj7VMde6qYHHvYLiPB6JWke4'

    // Convert base64url VAPID key to Uint8Array
    const key = vapidKey.replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(key);
    const applicationServerKey = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++)
      applicationServerKey[i] = raw.charCodeAt(i);

    // Check if already subscribed to avoid redundant re-subscription
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
    }

    const json = sub.toJSON()
    const p256dh = json.keys?.p256dh
    const auth = json.keys?.auth
    if (!p256dh || !auth) {
      console.log('[WebPush] Missing subscription keys')
      return
    }

    console.log('[WebPush] Saving subscription for user:', userId, 'endpoint:', sub.endpoint.slice(0, 60) + '...')

    const { client } = await import('./aws')
    const { data: existing } = await client.models.WebPushSubscription.list({ filter: { user_id: { eq: userId } } })
    let error = null
    if (existing.length > 0) {
      const { errors } = await client.models.WebPushSubscription.update({
        id: existing[0].id,
        endpoint: sub.endpoint,
        p256dh,
        auth,
      })
      error = errors ? errors[0] : null
    } else {
      const { errors } = await client.models.WebPushSubscription.create({
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh,
        auth,
      })
      error = errors ? errors[0] : null
    }
    if (error) {
      console.error('[WebPush] Failed to save subscription:', error.message)
    } else {
      console.log('[WebPush] Subscription saved successfully')
    }
  } catch (err) {
    console.error('[WebPush] subscribeToWebPush error:', err)
  }
}
