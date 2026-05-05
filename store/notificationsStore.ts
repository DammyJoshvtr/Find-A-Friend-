/**
 * store/notificationsStore.ts
 * Zustand store for in-app notifications.
 *
 * The root layout (`app/_layout.tsx`) should set up a Supabase realtime
 * channel after the user session is established:
 *
 *   supabase.channel('user-notifications')
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
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from '../lib/notifications'
import type { AppNotification } from '../lib/notifications'

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
        return { notifications: rolledBack, unreadCount: unread }
      })
    }
  },

  // -------------------------------------------------------------------------
  // Mark all notifications read
  // -------------------------------------------------------------------------
  markAllNotificationsRead: async () => {
    // Optimistic update
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, is_read: true })),
      unreadCount: 0,
    }))

    const { error } = await markAllRead()
    if (error) {
      // Reload from server on failure to restore correct state
      get().loadNotifications()
    }
  },

  // -------------------------------------------------------------------------
  // Realtime: new notification pushed by server
  // -------------------------------------------------------------------------
  addNotification: (notification: AppNotification) => {
    set(state => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.is_read ? 0 : 1),
    }))
  },
}))
