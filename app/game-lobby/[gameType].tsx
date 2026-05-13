import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import Toast from 'react-native-toast-message'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { GAME_META, getMyStats, type GameType, type UserGameStats } from '../../lib/games'
import { getFollowing, type FollowProfile } from '../../lib/follows'
import { usePresenceStore } from '../../store/presenceStore'
import { getInitials } from '../../lib/matching'
import NeuralBackground from '../../components/NeuralBackground'
import ScreenLoader from '../../components/ScreenLoader'

// ─── FAF Bot ──────────────────────────────────────────────────────────────────
export const FAF_BOT: FollowProfile = {
  id: 'faf-bot',
  full_name: 'FAF Bot',
  department: 'AI Opponent · Always ready',
  level: '∞',
  avatar_url: null,
  follower_count: 0,
  following_count: 0,
}

// ─── Demo online friends for when the user has none ──────────────────────────
const DEMO_FRIENDS: FollowProfile[] = [
  { id: 'demo-1', full_name: 'Ada Okonkwo',     department: 'Computer Science', level: '300', avatar_url: null, follower_count: 284, following_count: 91 },
  { id: 'demo-2', full_name: 'Emeka Nwosu',     department: 'Electrical Eng.',  level: '400', avatar_url: null, follower_count: 172, following_count: 63 },
  { id: 'demo-3', full_name: 'Zainab Bello',    department: 'Medicine',         level: '500', avatar_url: null, follower_count: 341, following_count: 110 },
  { id: 'demo-4', full_name: 'Chidi Obi',       department: 'Business Admin',   level: '200', avatar_url: null, follower_count: 98,  following_count: 54 },
]

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

export default function GameLobbyScreen() {
  const { gameType } = useLocalSearchParams<{ gameType: string }>()
  const gt = gameType as GameType
  const meta = GAME_META[gt]
  const theme = useTheme()
  const isOnline = usePresenceStore(s => s.isOnline)

  const [friends, setFriends] = useState<FollowProfile[]>([])
  const [stat, setStat] = useState<UserGameStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()

    const [followRes, statsRes] = await Promise.all([
      user ? getFollowing(user.id) : Promise.resolve({ data: null, error: null }),
      getMyStats(),
    ])

    const real = followRes.data ?? []
    // Always show FAF Bot first, then real friends (or demo friends if none)
    setFriends([FAF_BOT, ...(real.length > 0 ? real : DEMO_FRIENDS)])

    const allStats = statsRes.data ?? []
    setStat(allStats.find(s => s.game_type === gt) ?? null)
    setLoading(false)
  }

  const handleChallenge = async (friend: FollowProfile) => {
    // Bot — jump straight into the game
    if (friend.id === 'faf-bot') {
      router.push({ pathname: `/play/${gt}` as any, params: { opponentName: 'FAF Bot', opponentId: 'faf-bot' } })
      return
    }

    if (friend.id.startsWith('demo-')) {
      Toast.show({ type: 'info', text1: 'Demo mode', text2: 'Follow real users to challenge them!' })
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: cid, error } = await supabase.rpc('get_or_create_conversation', {
      p_other_user_id: friend.id,
    })

    if (error || !cid) {
      Toast.show({ type: 'error', text1: 'Could not send challenge', text2: error?.message })
      return
    }

    await supabase.from('messages').insert({
      conversation_id: cid,
      sender_id: user.id,
      body: JSON.stringify({
        _type: 'game_challenge',
        gameType: gt,
        emoji: meta.emoji,
        label: meta.label,
        challengerId: user.id,
      }),
    })

    Toast.show({ type: 'success', text1: 'Challenge sent! 🎮', text2: `${meta.emoji} ${meta.label}` })
    // Go to waiting room — host side
    router.push({
      pathname: '/play/waiting' as any,
      params: { gameType: gt, opponentId: friend.id, opponentName: friend.full_name ?? 'Opponent' },
    })
  }

  const handleRandomMatch = () => {
    Toast.show({
      type: 'info',
      text1: 'Matchmaking',
      text2: 'Random matching coming soon — challenge a friend for now!',
    })
  }

  if (!meta) return null

  const wins   = stat?.wins ?? 0
  const losses = stat?.losses ?? 0

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <NeuralBackground intensity="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: theme.text }]}>
            {meta.emoji} {meta.label}
          </Text>
          <TouchableOpacity
            style={[s.headerBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push(`/leaderboard/${gt}` as any)}>
            <Ionicons name="trophy-outline" size={16} color="#fbbf24" />
          </TouchableOpacity>
        </View>

        {/* Hero card */}
        <View style={[s.hero, { backgroundColor: meta.bg, borderColor: meta.border }]}>
          <Text style={s.heroEmoji}>{meta.emoji}</Text>
          <Text style={[s.heroTitle, { color: theme.text }]}>{meta.label}</Text>
          <Text style={[s.heroTagline, { color: theme.textMuted }]}>{meta.tagline}</Text>
          {stat && (
            <View style={s.heroRecord}>
              <View style={[s.recordPill, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
                <Text style={[s.recordText, { color: '#34d399' }]}>{wins}W</Text>
              </View>
              <View style={[s.recordPill, { backgroundColor: 'rgba(248,113,113,0.15)' }]}>
                <Text style={[s.recordText, { color: '#f87171' }]}>{losses}L</Text>
              </View>
              {wins + losses > 0 && (
                <View style={[s.recordPill, { backgroundColor: 'rgba(167,139,250,0.15)' }]}>
                  <Text style={[s.recordText, { color: theme.accent }]}>
                    {Math.round((wins / (wins + losses)) * 100)}% WR
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Rules */}
        <View style={[s.rulesCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[s.rulesTitle, { color: theme.text }]}>How to play</Text>
          {meta.rules.map((rule, i) => (
            <View key={i} style={s.ruleRow}>
              <View style={[s.ruleDot, { backgroundColor: meta.color }]} />
              <Text style={[s.ruleText, { color: theme.textMuted }]}>{rule}</Text>
            </View>
          ))}
        </View>

        {/* Friends list */}
        <Text style={[s.sectionLabel, { color: theme.text }]}>
          Challenge a Friend
        </Text>

        {loading ? (
          <ScreenLoader message="Loading players…" />
        ) : (
          <View style={[s.friendsList, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {friends.map((friend, i) => {
              const online = isOnline(friend.id)
              return (
                <View key={friend.id}>
                  <View style={s.friendRow}>
                    <View style={s.friendAvatarWrap}>
                      <Avatar url={friend.avatar_url} name={friend.full_name} size={42} theme={theme} />
                      <View style={[
                        s.onlineDot,
                        { backgroundColor: online ? '#4ade80' : theme.textFaint },
                      ]} />
                    </View>
                    <View style={s.friendInfo}>
                      <Text style={[s.friendName, { color: theme.text }]} numberOfLines={1}>
                        {friend.full_name ?? 'Player'}
                      </Text>
                      <Text style={[s.friendSub, { color: online ? '#4ade80' : theme.textFaint }]}>
                        {online ? 'Online now' : friend.department ?? 'Student'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[s.challengeBtn, { backgroundColor: meta.bg, borderColor: meta.border }]}
                      onPress={() => handleChallenge(friend)}>
                      <Ionicons name="flash" size={13} color={meta.color} />
                      <Text style={[s.challengeText, { color: meta.color }]}>Challenge</Text>
                    </TouchableOpacity>
                  </View>
                  {i < friends.length - 1 && (
                    <View style={[s.rowDiv, { backgroundColor: theme.border }]} />
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* Random match */}
        <TouchableOpacity
          style={[s.randomBtn, { backgroundColor: meta.bg, borderColor: meta.border }]}
          activeOpacity={0.8}
          onPress={handleRandomMatch}>
          <Ionicons name="shuffle" size={18} color={meta.color} />
          <Text style={[s.randomBtnText, { color: meta.color }]}>Find Random Match</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: typography.fontSemiBold },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 0.5,
  },

  hero: {
    borderRadius: 20, padding: 24, alignItems: 'center',
    marginBottom: 16, borderWidth: 1,
  },
  heroEmoji:  { fontSize: 56, marginBottom: 10 },
  heroTitle:  { fontSize: 22, fontFamily: typography.fontBold, marginBottom: 4 },
  heroTagline:{ fontSize: 13, fontFamily: typography.fontRegular, marginBottom: 14 },
  heroRecord: { flexDirection: 'row', gap: 8 },
  recordPill: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  recordText: { fontSize: 13, fontFamily: typography.fontSemiBold },

  rulesCard: {
    borderRadius: 18, padding: 16, marginBottom: 22,
    borderWidth: 0.5,
  },
  rulesTitle: { fontSize: 14, fontFamily: typography.fontSemiBold, marginBottom: 12 },
  ruleRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  ruleDot:    { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  ruleText:   { flex: 1, fontSize: 13, fontFamily: typography.fontRegular, lineHeight: 20 },

  sectionLabel: { fontSize: 15, fontFamily: typography.fontSemiBold, marginBottom: 12 },

  friendsList: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 16 },
  friendRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  friendAvatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 11, height: 11, borderRadius: 6,
    borderWidth: 2, borderColor: '#0d0d14',
  },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 14, fontFamily: typography.fontMedium },
  friendSub:  { fontSize: 11, fontFamily: typography.fontRegular, marginTop: 1 },
  challengeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1,
  },
  challengeText: { fontSize: 12, fontFamily: typography.fontSemiBold },
  rowDiv: { height: StyleSheet.hairlineWidth, marginLeft: 68 },

  randomBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 20, paddingVertical: 16, borderWidth: 1,
    marginBottom: 8,
  },
  randomBtnText: { fontSize: 15, fontFamily: typography.fontSemiBold },
})
