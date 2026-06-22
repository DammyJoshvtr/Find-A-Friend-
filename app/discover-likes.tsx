import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import { getLikesReceived, getMutualLikes, likeUser } from '../lib/discoverLikes'
import { followUser } from '../lib/follows'
import { getInitials } from '../lib/matching'
import type { FollowProfile } from '../lib/follows'
import { client } from '../lib/aws'
import { getCurrentUser } from 'aws-amplify/auth'
import Toast from 'react-native-toast-message'


function Avatar({ url, name, size, theme }: {
  url: string | null; name: string | null; size: number; theme: any
}) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: theme.card2, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.36, color: theme.accent, fontFamily: typography.fontBold }}>
        {getInitials(name ?? '?')}
      </Text>
    </View>
  )
}

function ProfileRow({
  user, theme, badge, actionType, onActionPress,
}: {
  user: FollowProfile
  theme: any
  badge?: React.ReactNode
  actionType: 'matches' | 'likes'
  onActionPress: () => void
}) {
  return (
    <View style={s.row}>
      <TouchableOpacity 
        style={s.rowLeft} 
        activeOpacity={0.75} 
        onPress={() => router.push(`/profile/${user.id}` as any)}>
        <View style={s.avatarWrap}>
          <Avatar url={user.avatar_url} name={user.full_name} size={50} theme={theme} />
          {badge}
        </View>
        <View style={s.rowInfo}>
          <Text style={[s.rowName, { color: theme.text }]} numberOfLines={1}>
            {user.full_name ?? 'Student'}
          </Text>
          <Text style={[s.rowSub, { color: theme.textMuted }]} numberOfLines={1}>
            {user.department ?? 'Student'}{user.level ? ` · ${user.level}` : ''}
          </Text>
          <Text style={[s.rowFollowers, { color: theme.textFaint }]}>
            {user.follower_count ?? 0} followers
          </Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          s.chatBtn,
          actionType === 'likes'
            ? { backgroundColor: theme.accent, borderColor: theme.accent }
            : { backgroundColor: 'rgba(167,139,250,0.12)', borderColor: 'rgba(167,139,250,0.3)' }
        ]}
        onPress={onActionPress}>
        {actionType === 'likes' ? (
          <>
            <Ionicons name="checkmark-circle-outline" size={14} color="#fff" style={{ marginRight: 2 }} />
            <Text style={[s.chatBtnText, { color: '#fff' }]}>Accept</Text>
          </>
        ) : (
          <>
            <Ionicons name="chatbubble-outline" size={14} color="#a78bfa" style={{ marginRight: 2 }} />
            <Text style={s.chatBtnText}>Message</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  )
}

export default function DiscoverLikesScreen() {
  const theme = useTheme()
  const [likedYou, setLikedYou] = useState<FollowProfile[]>([])
  const [matches, setMatches] = useState<FollowProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'matches' | 'likes'>('matches')

  useEffect(() => {
    load()

    let sub: any = null
    getCurrentUser().then((user) => {
      if (!user) return
      // TODO: Complex realtime channel
    })

    return () => {
    }
  }, [])

  const load = async () => {
    try {
      const [likesRes, mutualRes] = await Promise.all([
        getLikesReceived(),
        getMutualLikes(),
      ])
      const realLikes   = likesRes.data   ?? []
      const realMatches = mutualRes.data  ?? []

      setLikedYou(realLikes)
      setMatches(realMatches)
    } catch {
      setLikedYou([])
      setMatches([])
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptConnection = async (userId: string) => {
    try {
      // 1. Establish mutual connection by liking & following back
      await likeUser(userId)
      const { error } = await followUser(userId)
      if (error) {
        Toast.show({ type: 'error', text1: 'Could not connect', text2: error.message })
        return
      }
      
      Toast.show({ type: 'success', text1: 'Connected!', text2: 'You are now mutually connected' })
      
      // 2. Reload data to transition user into the Mutual list
      await load()
    } catch (e) {
      console.warn('[DiscoverLikes] accept connection error:', e)
    }
  }

  const displayed = tab === 'matches' ? matches : likedYou

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.text }]}>
            {tab === 'matches' ? 'Mutual Connections' : 'Connection Requests'}
          </Text>
          <Text style={[s.subtitle, { color: theme.textFaint }]}>
            {tab === 'matches'
              ? 'Students who you both connected with'
              : 'Students who requested to connect with you'}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[s.tabBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[s.tabItem, tab === 'matches' && { backgroundColor: theme.accent, borderRadius: 12 }]}
          onPress={() => setTab('matches')}>
          <Text style={[s.tabText, { color: tab === 'matches' ? '#fff' : theme.textMuted }]}>
            🤝 Mutual
          </Text>
          <View style={[s.countBadge, {
            backgroundColor: tab === 'matches' ? 'rgba(255,255,255,0.2)' : theme.card2,
          }]}>
            <Text style={[s.countText, { color: tab === 'matches' ? '#fff' : theme.accent }]}>
              {matches.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.tabItem, tab === 'likes' && { backgroundColor: theme.accent, borderRadius: 12 }]}
          onPress={() => setTab('likes')}>
          <Text style={[s.tabText, { color: tab === 'likes' ? '#fff' : theme.textMuted }]}>
            📥 Requests
          </Text>
          <View style={[s.countBadge, {
            backgroundColor: tab === 'likes' ? 'rgba(255,255,255,0.2)' : theme.card2,
          }]}>
            <Text style={[s.countText, { color: tab === 'likes' ? '#fff' : theme.accent }]}>
              {likedYou.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Matches explainer */}
      {tab === 'matches' && (
        <View style={[s.explainer, { backgroundColor: 'rgba(167,139,250,0.08)', borderColor: 'rgba(167,139,250,0.2)' }]}>
          <Ionicons name="people-outline" size={16} color={theme.accent} />
          <Text style={[s.explainerText, { color: theme.textMuted }]}>
            Mutual connections are students who both followed each other. Send them a message!
          </Text>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : displayed.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48 }}>{tab === 'matches' ? '🤝' : '📥'}</Text>
          <Text style={[s.emptyTitle, { color: theme.text }]}>
            {tab === 'matches' ? 'No mutual connections yet' : 'No requests yet'}
          </Text>
          <Text style={[s.emptyText, { color: theme.textMuted }]}>
            {tab === 'matches'
              ? "Connect with students in Discover — once they follow back, they'll appear here!"
              : 'When other students connect with you, they will appear here.'}
          </Text>
          <TouchableOpacity
            style={[s.discoverBtn, { backgroundColor: theme.accent }]}
            onPress={() => router.back()}>
            <Text style={s.discoverBtnText}>Back to Discover</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {displayed.map((user, i) => (
            <View key={user.id}>
              <ProfileRow
                user={user}
                theme={theme}
                actionType={tab}
                badge={
                  tab === 'matches' ? (
                    <View style={s.matchBadge}>
                      <Text style={{ fontSize: 10 }}>🤝</Text>
                    </View>
                  ) : (
                    <View style={s.likeBadge}>
                      <Text style={{ fontSize: 10 }}>👋</Text>
                    </View>
                  )
                }
                onActionPress={() => {
                  if (tab === 'matches') {
                    router.push(`/chat/${user.id}` as any)
                  } else {
                    handleAcceptConnection(user.id)
                  }
                }}
              />
              {i < displayed.length - 1 && (
                <View style={[s.divider, { backgroundColor: theme.border }]} />
              )}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  backBtn: { padding: 4 },
  title:   { fontSize: 22, fontFamily: typography.fontBold },
  subtitle:{ fontSize: 12, fontFamily: typography.fontRegular, marginTop: 1 },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, padding: 4, borderWidth: 0.5, gap: 4,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 10,
  },
  tabText:  { fontSize: 13, fontFamily: typography.fontSemiBold },
  countBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  countText:  { fontSize: 11, fontFamily: typography.fontBold },

  explainer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 12, padding: 12, borderWidth: 1,
  },
  explainerText: { flex: 1, fontSize: 12, fontFamily: typography.fontRegular, lineHeight: 18 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontFamily: typography.fontSemiBold, textAlign: 'center' },
  emptyText:  { fontSize: 13, fontFamily: typography.fontRegular, textAlign: 'center', lineHeight: 20 },
  discoverBtn: { borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12, marginTop: 4 },
  discoverBtnText: { fontSize: 14, fontFamily: typography.fontSemiBold, color: '#fff' },

  list: { paddingHorizontal: 16 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarWrap: { position: 'relative' },
  matchBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center',
  },
  likeBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#f472b6', alignItems: 'center', justifyContent: 'center',
  },
  rowInfo:    { flex: 1 },
  rowName:    { fontSize: 15, fontFamily: typography.fontSemiBold },
  rowSub:     { fontSize: 12, fontFamily: typography.fontRegular, marginTop: 2 },
  rowFollowers: { fontSize: 11, fontFamily: typography.fontRegular, marginTop: 2 },

  chatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1,
  },
  chatBtnText: { fontSize: 11, fontFamily: typography.fontSemiBold, color: '#a78bfa' },

  divider: { height: StyleSheet.hairlineWidth },
})
