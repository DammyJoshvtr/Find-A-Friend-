import React, { useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useNotificationsStore } from '../store/notificationsStore'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import { getInitials, getTimeAgo } from '../lib/matching'
import type { AppNotification, NotificationType } from '../lib/notifications'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type IconName = keyof typeof import('@expo/vector-icons').Ionicons.glyphMap

function getNotificationIcon(type: NotificationType): { name: IconName; color: string } {
  switch (type) {
    case 'like':               return { name: 'heart',          color: '#ef4444' }
    case 'comment':            return { name: 'chatbubble',     color: '#60a5fa' }
    case 'repost':             return { name: 'repeat',         color: '#34d399' }
    case 'follow':             return { name: 'person-add',     color: '#a78bfa' }
    case 'connection_request': return { name: 'people',         color: '#a78bfa' }
    case 'event_rsvp':         return { name: 'calendar',       color: '#fbbf24' }
    case 'club_announcement':  return { name: 'megaphone',      color: '#f472b6' }
    case 'story_view':         return { name: 'eye',            color: '#c084fc' }
    case 'mention':            return { name: 'at',             color: '#60a5fa' }
    case 'new_message':        return { name: 'chatbubbles',    color: '#34d399' }
    case 'comment_reply':      return { name: 'chatbubble-ellipses', color: '#60a5fa' }
    default:                   return { name: 'notifications',  color: '#a78bfa' }
  }
}

function getNotificationBody(notif: AppNotification): string {
  if (notif.body) return notif.body
  const actor = notif.actor?.full_name ?? 'Someone'
  switch (notif.type) {
    case 'like':               return `${actor} liked your post`
    case 'comment':            return `${actor} commented on your post`
    case 'repost':             return `${actor} reposted your post`
    case 'follow':             return `${actor} started following you`
    case 'connection_request': return `${actor} sent you a connection request`
    case 'event_rsvp':         return `${actor} is attending your event`
    case 'club_announcement':  return 'New announcement in your club'
    case 'story_view':         return `${actor} viewed your story`
    case 'mention':            return `${actor} mentioned you in a post`
    case 'new_message':        return `${actor} sent you a message`
    case 'comment_reply':      return `${actor} replied to your comment`
    default:                   return 'You have a new notification'
  }
}

function getNotificationRoute(notif: AppNotification): string | null {
  // new_message notifications always go to the sender's DM chat,
  // regardless of entity_type — actor_id is the sender.
  if (notif.type === 'new_message' && notif.actor_id) {
    return `/chat/${notif.actor_id}`
  }
  if (!notif.entity_id) return null
  switch (notif.entity_type) {
    case 'post':  return `/post/${notif.entity_id}`
    case 'event': return `/event/${notif.entity_id}`
    case 'club':  return `/club/${notif.entity_id}`
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
  const theme = useTheme()
  const { name, color } = getNotificationIcon(notif.type)
  const body = getNotificationBody(notif)

  return (
    <TouchableOpacity
      style={[s.row, !notif.is_read && { backgroundColor: theme.accentBg }]}
      onPress={() => onPress(notif)}
      activeOpacity={0.7}>
      {/* Avatar with type badge */}
      <View style={s.avatarWrap}>
        {notif.actor?.avatar_url ? (
          <Image source={{ uri: notif.actor.avatar_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatarPlaceholder, { backgroundColor: color + '22' }]}>
            <Text style={[s.avatarInitials, { color }]}>
              {getInitials(notif.actor?.full_name ?? '??')}
            </Text>
          </View>
        )}
        <View style={[s.iconBadge, { backgroundColor: color, borderColor: theme.bg }]}>
          <Ionicons name={name} size={9} color="#fff" />
        </View>
      </View>

      {/* Body */}
      <View style={{ flex: 1 }}>
        <Text style={[s.body, { color: theme.text }]} numberOfLines={2}>{body}</Text>
        <Text style={[s.time, { color: theme.textFaint }]}>{getTimeAgo(notif.created_at)}</Text>
      </View>

      {/* Unread dot */}
      {!notif.is_read && (
        <View style={[s.unreadDot, { backgroundColor: theme.accent }]} />
      )}
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NotificationsScreen() {
  const theme = useTheme()
  const {
    notifications, loading, unreadCount,
    loadNotifications, markNotificationRead, markAllNotificationsRead,
    clearAllNotifications,
  } = useNotificationsStore()

  useEffect(() => { loadNotifications() }, [])

  const handlePress = useCallback(async (notif: AppNotification) => {
    if (!notif.is_read) markNotificationRead(notif.id)
    const route = getNotificationRoute(notif)
    if (route) {
      router.push(route as any)
    } else if (notif.type === 'follow' || notif.type === 'connection_request') {
      if (notif.actor_id) router.push(`/profile/${notif.actor_id}` as any)
    } else if (notif.actor_id) {
      router.push(`/profile/${notif.actor_id}` as any)
    }
  }, [markNotificationRead])

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Notifications</Text>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {notifications.length > 0 && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)' }]}
              onPress={clearAllNotifications}>
              <Text style={[s.actionBtnText, { color: '#ef4444' }]}>Clear all</Text>
            </TouchableOpacity>
          )}
          {unreadCount > 0 && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}
              onPress={markAllNotificationsRead}>
              <Text style={[s.actionBtnText, { color: theme.accent }]}>Mark all read</Text>
            </TouchableOpacity>
          )}
          {notifications.length === 0 && unreadCount === 0 && <View style={{ width: 8 }} />}
        </View>
      </View>

      {loading && !notifications.length ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <NotifRow notif={item} onPress={handlePress} />}
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: theme.border, marginLeft: 72 }]} />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="notifications-outline" size={48} color={theme.textFaint} />
              <Text style={[s.emptyTitle, { color: theme.textMuted }]}>No notifications yet</Text>
              <Text style={[s.emptySub, { color: theme.textFaint }]}>
                You'll see likes, comments, and more here
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          onRefresh={loadNotifications}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container:  { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', borderWidth: 0.5,
  },
  title:       { fontSize: 18, fontFamily: typography.fontBold },
  markAllBtn: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 0.5,
  },
  markAllText: { fontSize: 11, fontFamily: typography.fontMedium },
  actionBtn: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5,
  },
  actionBtnText: { fontSize: 11, fontFamily: typography.fontMedium },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Row */
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  avatarWrap:       { position: 'relative', width: 46, height: 46, flexShrink: 0 },
  avatar:           { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials:   { fontSize: 13, fontFamily: typography.fontBold },
  iconBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  body:             { fontSize: 13, fontFamily: typography.fontRegular, lineHeight: 18, marginBottom: 3 },
  time:             { fontSize: 11, fontFamily: typography.fontRegular },
  unreadDot:        { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  separator:        { height: 0.5 },

  /* Empty */
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, gap: 10,
  },
  emptyTitle: { fontSize: 16, fontFamily: typography.fontSemiBold },
  emptySub:   { fontSize: 13, fontFamily: typography.fontRegular, textAlign: 'center', paddingHorizontal: 40 },
})
