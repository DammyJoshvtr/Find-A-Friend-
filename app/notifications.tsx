/**
 * app/notifications.tsx
 * Notifications screen — FlatList with mark-all-read, realtime via store.
 */
import React, { useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useNotificationsStore } from '../store/notificationsStore'
import { getInitials, getTimeAgo } from '../lib/matching'
import type { AppNotification, NotificationType } from '../lib/notifications'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNotificationIcon(type: NotificationType): {
  name: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap
  color: string
} {
  switch (type) {
    case 'like':
      return { name: 'heart', color: '#ef4444' }
    case 'comment':
      return { name: 'chatbubble', color: '#60a5fa' }
    case 'repost':
      return { name: 'repeat', color: '#34d399' }
    case 'follow':
      return { name: 'person-add', color: '#a78bfa' }
    case 'connection_request':
      return { name: 'people', color: '#a78bfa' }
    case 'event_rsvp':
      return { name: 'calendar', color: '#fbbf24' }
    case 'club_announcement':
      return { name: 'megaphone', color: '#f472b6' }
    case 'story_view':
      return { name: 'eye', color: '#c084fc' }
    case 'mention':
      return { name: 'at', color: '#60a5fa' }
    case 'new_message':
      return { name: 'chatbubbles', color: '#34d399' }
    default:
      return { name: 'notifications', color: '#a78bfa' }
  }
}

function getNotificationBody(notif: AppNotification): string {
  if (notif.body) return notif.body
  const actor = notif.actor?.full_name ?? 'Someone'
  switch (notif.type) {
    case 'like':           return `${actor} liked your post`
    case 'comment':        return `${actor} commented on your post`
    case 'repost':         return `${actor} reposted your post`
    case 'follow':         return `${actor} started following you`
    case 'connection_request': return `${actor} sent you a connection request`
    case 'event_rsvp':     return `${actor} is attending your event`
    case 'club_announcement': return 'New announcement in your club'
    case 'story_view':     return `${actor} viewed your story`
    case 'mention':        return `${actor} mentioned you in a post`
    case 'new_message':    return `${actor} sent you a message`
    default:               return 'You have a new notification'
  }
}

function getNotificationRoute(notif: AppNotification): string | null {
  if (!notif.entity_id) return null
  switch (notif.entity_type) {
    case 'post':  return `/post/${notif.entity_id}`
    case 'event': return `/event/${notif.entity_id}`
    case 'club':  return `/club/${notif.entity_id}`
    case 'story': return null
    default:      return null
  }
}

// ---------------------------------------------------------------------------
// Notification row
// ---------------------------------------------------------------------------

interface NotifRowProps {
  notif: AppNotification
  onPress: (notif: AppNotification) => void
}

function NotifRow({ notif, onPress }: NotifRowProps) {
  const { name, color } = getNotificationIcon(notif.type)
  const body = getNotificationBody(notif)

  return (
    <TouchableOpacity
      style={[s.row, !notif.is_read && s.rowUnread]}
      onPress={() => onPress(notif)}
      activeOpacity={0.7}>
      {/* Avatar or icon */}
      <View style={s.avatarWrap}>
        {notif.actor?.avatar_url ? (
          <Image source={{ uri: notif.actor.avatar_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatarPlaceholder, { backgroundColor: color + '20' }]}>
            <Text style={s.avatarInitials}>
              {getInitials(notif.actor?.full_name ?? '??')}
            </Text>
          </View>
        )}
        {/* Type badge */}
        <View style={[s.iconBadge, { backgroundColor: color }]}>
          <Ionicons name={name} size={9} color="#fff" />
        </View>
      </View>

      {/* Body */}
      <View style={{ flex: 1 }}>
        <Text style={s.body} numberOfLines={2}>{body}</Text>
        <Text style={s.time}>{getTimeAgo(notif.created_at)}</Text>
      </View>

      {/* Unread dot */}
      {!notif.is_read && <View style={s.unreadDot} />}
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NotificationsScreen() {
  const {
    notifications, loading, unreadCount,
    loadNotifications, markNotificationRead, markAllNotificationsRead,
  } = useNotificationsStore()

  useEffect(() => {
    loadNotifications()
  }, [])

  const handlePress = useCallback(async (notif: AppNotification) => {
    if (!notif.is_read) {
      markNotificationRead(notif.id)
    }
    const route = getNotificationRoute(notif)
    if (route) router.push(route as any)
    else if (notif.actor_id) router.push(`/profile/${notif.actor_id}` as any)
  }, [markNotificationRead])

  const handleMarkAllRead = useCallback(() => {
    markAllNotificationsRead()
  }, [markAllNotificationsRead])

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#f0f0ff" />
        </TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity style={s.markAllBtn} onPress={handleMarkAllRead}>
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={{ width: 80 }} />}
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <NotifRow notif={item} onPress={handlePress} />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="notifications-outline" size={48} color="rgba(240,240,255,0.1)" />
              <Text style={s.emptyTitle}>No notifications yet</Text>
              <Text style={s.emptySub}>You'll see likes, comments, and more here</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          onRefresh={loadNotifications}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#f0f0ff' },
  markAllBtn: {
    backgroundColor: 'rgba(167,139,250,0.12)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  markAllText: { fontSize: 11, color: '#a78bfa', fontWeight: '500' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rowUnread: { backgroundColor: 'rgba(167,139,250,0.04)' },
  avatarWrap: { position: 'relative', width: 44, height: 44, flexShrink: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 13, fontWeight: '700', color: '#c4b5fd' },
  iconBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#0d0d14',
  },
  body: { fontSize: 13, color: '#f0f0ff', lineHeight: 18, marginBottom: 3 },
  time: { fontSize: 11, color: 'rgba(240,240,255,0.35)' },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#a78bfa', flexShrink: 0,
  },
  separator: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginLeft: 72,
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: 'rgba(240,240,255,0.4)' },
  emptySub: { fontSize: 13, color: 'rgba(240,240,255,0.25)', textAlign: 'center', paddingHorizontal: 40 },
})
