/**
 * store/notificationsStore.ts
 * Zustand store for in-app notifications.
 *
 * The root layout (`app/_layout.tsx`) should set up a Supabase realtime
 * channel after the user session is established:
 *
 *   // supabase.channel('user-notifications')
 *     .on('postgres_changes', {
 *       event: 'INSERT',
 *       schema: 'public',
 *       table: 'notifications',
 *       filter: `user_id=eq.${session.user.id}`,
 *     }, payload => {
 *       useNotificationsStore.getState().addNotification(payload.new as AppNotification)
 *     })
 *     .subscribe()
 *
 * The store drives:
 *  - The red badge count on the More tab icon
 *  - The notifications list screen
 */
import { create } from 'zustand'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteAllNotifications,
} from '../lib/notifications'
import type { AppNotification } from '../lib/notifications'

// ---------------------------------------------------------------------------
// Helper: update app icon badge count
// ---------------------------------------------------------------------------

async function updateAppBadge(count: number) {
  if (Platform.OS !== 'web') {
    try {
      await Notifications.setBadgeCountAsync(count)
    } catch (err) {
      console.warn('[Badge] Failed to set badge count:', err)
    }
  }
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface NotificationsState {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  error: string | null

  // Actions
  loadNotifications: () => Promise<void>
  loadUnreadCount: () => Promise<void>
  markNotificationRead: (notificationId: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  clearAllNotifications: () => Promise<void>
  /** Called by the realtime subscription when a new notification arrives */
  addNotification: (notification: AppNotification) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  // -------------------------------------------------------------------------
  // Load notification list
  // -------------------------------------------------------------------------
  loadNotifications: async () => {
    set({ loading: true, error: null })

    try {
      const { data, error } = await getNotifications(false, 50)
      if (error) throw error

      const notifs = data ?? []
      const unread = notifs.filter(n => !n.is_read).length

      set({
        notifications: notifs,
        unreadCount: unread,
        loading: false,
      })
      updateAppBadge(unread)
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  // -------------------------------------------------------------------------
  // Just refresh the badge count (cheap query)
  // -------------------------------------------------------------------------
  loadUnreadCount: async () => {
    try {
      const count = await getUnreadCount()
      set({ unreadCount: count })
      updateAppBadge(count)
    } catch {
      // Non-fatal — badge count will be stale until next refresh
    }
  },

  // -------------------------------------------------------------------------
  // Mark one notification read
  // -------------------------------------------------------------------------
  markNotificationRead: async (notificationId: string) => {
    // Optimistic update
    set(state => {
      const updated = state.notifications.map(n =>
        n.id === notificationId ? { ...n, is_read: true } : n
      )
      const unread = updated.filter(n => !n.is_read).length
      updateAppBadge(unread)
      return { notifications: updated, unreadCount: unread }
    })

    // Server persist
    const { error } = await markRead(notificationId)
    if (error) {
      // Rollback on failure
      set(state => {
        const rolledBack = state.notifications.map(n =>
          n.id === notificationId ? { ...n, is_read: false } : n
        )
        const unread = rolledBack.filter(n => !n.is_read).length
        updateAppBadge(unread)
        return { notifications: rolledBack, unreadCount: unread }
      })
    }
  },

  // -------------------------------------------------------------------------
  // Mark all notifications read
  // -------------------------------------------------------------------------
  markAllNotificationsRead: async () => {
    // Optimistic update
    set(state => {
      updateAppBadge(0)
      return {
        notifications: state.notifications.map(n => ({ ...n, is_read: true })),
        unreadCount: 0,
      }
    })

    const { error } = await markAllRead()
    if (error) {
      // Reload from server on failure to restore correct state
      get().loadNotifications()
    }
  },

  // -------------------------------------------------------------------------
  // Clear all notifications
  // -------------------------------------------------------------------------
  clearAllNotifications: async () => {
    // Optimistic update
    set({ notifications: [], unreadCount: 0 })
    updateAppBadge(0)
    const { error } = await deleteAllNotifications()
    if (error) {
      // Reload from server on failure
      get().loadNotifications()
    }
  },

  // -------------------------------------------------------------------------
  // Realtime: new notification pushed by server
  // -------------------------------------------------------------------------
  addNotification: (notification: AppNotification) => {
    set(state => {
      const newCount = state.unreadCount + (notification.is_read ? 0 : 1)
      updateAppBadge(newCount)
      return {
        notifications: [notification, ...state.notifications],
        unreadCount: newCount,
      }
    })
  },
}))
