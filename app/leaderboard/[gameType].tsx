import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { getLeaderboard, GAME_META, type GameType, type LeaderboardEntry } from '../../lib/games'
import { getInitials } from '../../lib/matching'
import { client } from '../../lib/aws'
import { getCurrentUser } from 'aws-amplify/auth'
import NeuralBackground from '../../components/NeuralBackground'
import ScreenLoader from '../../components/ScreenLoader'

const MIN_LOADER_MS = 1200


const MEDAL_COLORS: Record<number, string> = {
  1: '#fbbf24',
  2: '#94a3b8',
  3: '#cd7c5a',
}

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

export default function LeaderboardScreen() {
  const { gameType } = useLocalSearchParams<{ gameType: string }>()
  const gt = gameType as GameType
  const meta = GAME_META[gt]
  const theme = useTheme()

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [myEntry, setMyEntry] = useState<{ rank: number; entry: LeaderboardEntry } | null>(null)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<any>(null)
  const currentUserRef = useRef<string | null>(null)

  useEffect(() => {
    load()

    // Realtime: refresh whenever a game_session is inserted or updated
    // (covers both new results and score corrections)
    // TODO: Complex realtime channel
    return () => {
    }
  }, [gt])

  const fetchEntries = async (): Promise<LeaderboardEntry[]> => {
    const { data } = await getLeaderboard(gt, 20)
    return data ?? []
  }

  const load = async () => {
    setLoading(true)
    try {
      const [list] = await Promise.all([
        fetchEntries(),
        new Promise<void>(r => setTimeout(r, MIN_LOADER_MS)),
      ])
      const user = await getCurrentUser().catch(() => null)
      currentUserRef.current = user?.userId ?? null
      setEntries(list)
      if (user) {
        const idx = list.findIndex(e => e.user_id === user.userId)
        if (idx !== -1) setMyEntry({ rank: idx + 1, entry: list[idx] })
        else setMyEntry(null)
      }
    } catch {
      // Non-fatal — display demo data that was set by fetchEntries
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    try {
      const list = await fetchEntries()
      setEntries(list)
      const uid = currentUserRef.current
      if (uid) {
        const idx = list.findIndex(e => e.user_id === uid)
        setMyEntry(idx !== -1 ? { rank: idx + 1, entry: list[idx] } : null)
      }
    } catch {
      // Non-fatal — keep current entries
    }
  }

  if (loading || !meta) {
    return <ScreenLoader message="Loading rankings…" />
  }

  const top3 = entries.slice(0, 3)
  const rest  = entries.slice(3)

  const podiumOrder = top3.length === 3
    ? [top3[1], top3[0], top3[2]]   // silver · gold · bronze left-to-right
    : top3

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
            {meta.emoji} Leaderboard
          </Text>
          <TouchableOpacity
            style={[s.playBtn, { backgroundColor: meta.bg, borderColor: meta.border }]}
            onPress={() => router.push(`/game-lobby/${gt}` as any)}>
            <Text style={[s.playBtnText, { color: meta.color }]}>Play</Text>
          </TouchableOpacity>
        </View>

        {entries.length === 0 ? (
          <View style={[s.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 32 }}>🏆</Text>
              <Text style={[s.playerName, { color: theme.textMuted, textAlign: 'center' }]}>
                No games played yet
              </Text>
              <Text style={[s.playerSub, { color: theme.textFaint, textAlign: 'center' }]}>
                Be the first to play and claim the top spot!
              </Text>
            </View>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(600)} style={{ flex: 1 }}>
            {/* Podium — top 3 */}
            {top3.length >= 3 && (
              <View style={[s.podiumCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.podiumTitle, { color: theme.textFaint }]}>🏟 Campus Podium</Text>
                <View style={s.podium}>
                  {podiumOrder.map((entry, pIdx) => {
                    const actualRank = top3.indexOf(entry) + 1
                    const height = actualRank === 1 ? 90 : actualRank === 2 ? 72 : 58
                    const medalColor = MEDAL_COLORS[actualRank]
                    return (
                      <View key={entry.user_id} style={s.podiumCol}>
                        <Avatar url={entry.avatar_url} name={entry.full_name} size={48} theme={theme} />
                        <Text style={[s.podiumName, { color: theme.text }]} numberOfLines={1}>
                          {entry.full_name?.split(' ')[0]}
                        </Text>
                        <Text style={[s.podiumWins, { color: medalColor }]}>{entry.wins}W</Text>
                        <View style={[s.podiumBase, { height, backgroundColor: `${medalColor}22`, borderTopColor: medalColor }]}>
                          <Text style={[s.podiumRank, { color: medalColor }]}>
                            {actualRank === 1 ? '🥇' : actualRank === 2 ? '🥈' : '🥉'}
                          </Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              </View>
            )}

            {/* My rank banner */}
            {myEntry && (
              <View style={[s.myRankCard, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                <Ionicons name="person" size={16} color={meta.color} />
                <Text style={[s.myRankText, { color: meta.color }]}>
                  You're ranked #{myEntry.rank} with {myEntry.entry.wins} wins
                </Text>
              </View>
            )}

            {/* Full ranked list */}
            <View style={[s.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {/* Column headers */}
              <View style={s.listHeader}>
                <Text style={[s.colRank, s.colHeader, { color: theme.textFaint }]}>#</Text>
                <Text style={[s.colName, s.colHeader, { color: theme.textFaint }]}>Player</Text>
                <Text style={[s.colWins, s.colHeader, { color: theme.textFaint }]}>Wins</Text>
                <Text style={[s.colRate, s.colHeader, { color: theme.textFaint }]}>Rate</Text>
              </View>

              {entries.map((entry, i) => {
                const rank = i + 1
                const medalColor = MEDAL_COLORS[rank]
                const isMe = myEntry?.entry.user_id === entry.user_id
                return (
                  <View key={entry.user_id}>
                    <View style={[
                      s.listRow,
                      isMe && { backgroundColor: `${meta.color}0d` },
                    ]}>
                      {/* Rank */}
                      <View style={s.colRank}>
                        {rank <= 3 ? (
                          <Text style={{ fontSize: 16 }}>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</Text>
                        ) : (
                          <Text style={[s.rankNum, { color: theme.textFaint }]}>{rank}</Text>
                        )}
                      </View>

                      {/* Player */}
                      <View style={[s.colName, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                        <Avatar url={entry.avatar_url} name={entry.full_name} size={32} theme={theme} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.playerName, { color: theme.text }]} numberOfLines={1}>
                            {entry.full_name ?? 'Player'}
                            {isMe && <Text style={{ color: meta.color }}> (you)</Text>}
                          </Text>
                          <Text style={[s.playerSub, { color: theme.textFaint }]}>
                            {entry.games_played} games
                          </Text>
                        </View>
                      </View>

                      {/* Wins */}
                      <Text style={[s.colWins, s.winsText, { color: medalColor ?? theme.text }]}>
                        {entry.wins}
                      </Text>

                      {/* Win rate */}
                      <Text style={[s.colRate, s.rateText, { color: theme.textMuted }]}>
                        {entry.win_rate}%
                      </Text>
                    </View>
                    {i < entries.length - 1 && (
                      <View style={[s.rowDiv, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                )
              })}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 16 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: typography.fontSemiBold },
  playBtn: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  playBtnText: { fontSize: 13, fontFamily: typography.fontSemiBold },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  centerText: { fontSize: 13, fontFamily: typography.fontRegular },

  // Podium
  podiumCard: {
    borderRadius: 20, paddingTop: 20, paddingBottom: 0,
    borderWidth: 0.5, marginBottom: 14, overflow: 'hidden',
  },
  podiumTitle: {
    textAlign: 'center', fontSize: 12,
    fontFamily: typography.fontMedium, marginBottom: 20,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 0 },
  podiumCol: { flex: 1, alignItems: 'center', paddingBottom: 0 },
  podiumName: { fontSize: 12, fontFamily: typography.fontSemiBold, marginTop: 6, marginBottom: 2 },
  podiumWins: { fontSize: 11, fontFamily: typography.fontBold, marginBottom: 8 },
  podiumBase: {
    width: '100%', alignItems: 'center', justifyContent: 'center',
    borderTopWidth: 2,
  },
  podiumRank: { fontSize: 24, paddingVertical: 10 },

  // My rank
  myRankCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14,
  },
  myRankText: { fontSize: 13, fontFamily: typography.fontMedium },

  // List
  listCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  listHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  colHeader: { fontSize: 10, fontFamily: typography.fontMedium, textTransform: 'uppercase', letterSpacing: 0.5 },
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  colRank: { width: 36 },
  colName: { flex: 1 },
  colWins: { width: 44, textAlign: 'right' },
  colRate: { width: 44, textAlign: 'right' },
  rankNum: { fontSize: 14, fontFamily: typography.fontSemiBold },
  playerName: { fontSize: 13, fontFamily: typography.fontMedium },
  playerSub:  { fontSize: 10, fontFamily: typography.fontRegular, marginTop: 1 },
  winsText: { fontSize: 14, fontFamily: typography.fontBold },
  rateText: { fontSize: 12, fontFamily: typography.fontMedium },
  rowDiv: { height: StyleSheet.hairlineWidth, marginLeft: 50 },
})
