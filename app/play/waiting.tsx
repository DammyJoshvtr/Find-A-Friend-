/**
 * app/play/waiting.tsx
 * Waiting room — shown after accepting a game challenge.
 * Creates or joins a live_game_sessions row, waits for both players,
 * then navigates into the actual game. Session can be resumed if interrupted.
 */
import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withSpring, Easing,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { GAME_META, type GameType } from '../../lib/games'
import { getInitials } from '../../lib/matching'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveSession {
  id: string
  game_type: GameType
  host_id: string
  guest_id: string | null
  status: 'waiting' | 'active' | 'paused' | 'finished'
  state: Record<string, unknown>
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function PlayerSlot({ name, label, ready, theme }: {
  name: string; label: string; ready: boolean; theme: any
}) {
  const scale = useSharedValue(1)
  const glow  = useSharedValue(0.4)

  useEffect(() => {
    if (ready) {
      scale.value = withSpring(1.05, { damping: 10 })
      glow.value  = withRepeat(withSequence(
        withTiming(1,   { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ), -1, true)
    } else {
      glow.value = withRepeat(withSequence(
        withTiming(0.6, { duration: 1400 }),
        withTiming(0.15, { duration: 1400 }),
      ), -1, true)
    }
  }, [ready])

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    shadowOpacity: glow.value,
  }))

  return (
    <View style={ps.col}>
      <Animated.View style={[ps.avatarOuter, glowStyle,
        ready && { shadowColor: '#4ade80', shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }
      ]}>
        <Animated.View style={[ps.avatar, avatarStyle,
          { backgroundColor: ready ? 'rgba(74,222,128,0.15)' : 'rgba(167,139,250,0.1)',
            borderColor:      ready ? '#4ade80' : 'rgba(167,139,250,0.4)' }
        ]}>
          {ready
            ? <Text style={ps.initials}>{getInitials(name)}</Text>
            : <ActivityIndicator size="small" color="rgba(167,139,250,0.5)" />
          }
        </Animated.View>
      </Animated.View>
      <Text style={[ps.name, { color: ready ? '#f0e8ff' : 'rgba(200,180,255,0.4)' }]} numberOfLines={1}>
        {ready ? name : '…'}
      </Text>
      <View style={[ps.statusPill, { backgroundColor: ready ? 'rgba(74,222,128,0.1)' : 'rgba(167,139,250,0.06)', borderColor: ready ? 'rgba(74,222,128,0.35)' : 'rgba(167,139,250,0.2)' }]}>
        <Text style={[ps.statusText, { color: ready ? '#4ade80' : 'rgba(167,139,250,0.45)' }]}>
          {ready ? '● Ready' : '○ Waiting...'}
        </Text>
      </View>
      <Text style={ps.label}>{label}</Text>
    </View>
  )
}

const ps = StyleSheet.create({
  col:         { alignItems: 'center', gap: 8, flex: 1 },
  avatarOuter: { elevation: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  initials:   { fontSize: 26, fontFamily: typography.fontBold, color: '#f0e8ff' },
  name:       { fontSize: 14, fontFamily: typography.fontSemiBold, maxWidth: 120, textAlign: 'center' },
  statusPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 11, fontFamily: typography.fontMedium },
  label:      { fontSize: 10, fontFamily: typography.fontRegular, color: 'rgba(200,180,255,0.3)', marginTop: 2 },
})

// ─── Main component ───────────────────────────────────────────────────────────

export default function WaitingScreen() {
  const theme  = useTheme()
  const params = useLocalSearchParams<{
    gameType: string
    sessionId?: string
    opponentId?: string
    opponentName?: string
  }>()
  const gt       = params.gameType as GameType
  const meta     = GAME_META[gt] ?? GAME_META.trivia
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const [myId,          setMyId]          = useState('')
  const [myName,        setMyName]        = useState('You')
  const [sessionId,     setSessionId]     = useState(params.sessionId ?? '')
  const [opponentName,  setOpponentName]  = useState(params.opponentName ?? '...')
  const [opponentReady, setOpponentReady] = useState(false)
  const [phase,         setPhase]         = useState<'creating' | 'waiting' | 'launching'>('creating')
  const [error,         setError]         = useState('')
  const [dots,          setDots]          = useState('.')

  // Animated scan line
  const scanLine = useSharedValue(0)
  const pulsePY  = useSharedValue(1)
  useEffect(() => {
    scanLine.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false)
    pulsePY.value  = withRepeat(withSequence(
      withTiming(1.08, { duration: 1200 }), withTiming(0.92, { duration: 1200 })
    ), -1, true)
  }, [])
  const scanStyle   = useAnimatedStyle(() => ({ top: `${scanLine.value * 100}%` as any }))
  const pulseStyle  = useAnimatedStyle(() => ({ transform: [{ scale: pulsePY.value }] }))

  // Animated dots
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500)
    return () => clearInterval(id)
  }, [])

  // Init: load user + create or join session
  useEffect(() => {
    init()
    return () => { channelRef.current && supabase.removeChannel(channelRef.current) }
  }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); return }
    setMyId(user.id)

    // Fetch my name
    const { data: prof } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single()
    setMyName(prof?.full_name ?? 'You')

    if (params.sessionId) {
      // Rejoining existing session
      await joinSession(params.sessionId, user.id)
    } else if (params.opponentId && params.opponentId !== 'faf-bot') {
      // Challenger — create session
      await createSession(user.id, params.opponentId)
    } else {
      // Bot game — go straight in
      launchGame(null)
    }
  }

  const createSession = async (hostId: string, guestId: string) => {
    const { data, error: err } = await supabase
      .from('live_game_sessions')
      .insert({ game_type: gt, host_id: hostId, guest_id: guestId, status: 'waiting' })
      .select('id')
      .single()

    if (err || !data) { setError('Could not create session'); return }
    setSessionId(data.id)
    setPhase('waiting')
    subscribeToSession(data.id, hostId)
  }

  const joinSession = async (sid: string, userId: string) => {
    // Guest joins by setting themselves as guest and status → active
    const { data, error: err } = await supabase
      .from('live_game_sessions')
      .update({ guest_id: userId, status: 'active' })
      .eq('id', sid)
      .select()
      .single()

    if (err || !data) { setError('Could not join session'); return }
    setPhase('waiting')
    subscribeToSession(sid, userId)
  }

  const subscribeToSession = (sid: string, userId: string) => {
    channelRef.current = supabase
      .channel(`live-session-${sid}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_game_sessions',
        filter: `id=eq.${sid}`,
      }, (payload: any) => {
        const s = payload.new as LiveSession
        const isHost  = s.host_id === userId
        const partner = isHost ? s.guest_id : s.host_id

        if (partner) {
          setOpponentReady(true)
          // Fetch partner name
          supabase.from('profiles').select('full_name').eq('id', partner).single()
            .then(({ data: p }) => p && setOpponentName(p.full_name ?? 'Opponent'))
        }

        if (s.status === 'active' && s.guest_id && s.host_id) {
          // Both joined — launch
          setPhase('launching')
          setTimeout(() => launchGame(sid), 1200)
        }
      })
      .subscribe()
  }

  const launchGame = (sid: string | null) => {
    const route = gt === 'trivia'
      ? '/play/trivia'
      : gt === 'wordle'
        ? '/play/wordle'
        : '/play/pool'
    router.replace({
      pathname: route as any,
      params: {
        opponentName: opponentName,
        opponentId: params.opponentId,
        sessionId: sid ?? '',
      },
    })
  }

  const cancelAndBack = async () => {
    if (sessionId) {
      await supabase.from('live_game_sessions').update({ status: 'finished' }).eq('id', sessionId)
    }
    router.back()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[s.container, { backgroundColor: '#07070f' }]}>

      {/* Scan lines background */}
      <View style={s.bg} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[s.gridLine, { top: `${i * 14}%` as any }]} />
        ))}
      </View>

      {/* Back */}
      <TouchableOpacity style={s.backBtn} onPress={cancelAndBack}>
        <Ionicons name="arrow-back" size={20} color="rgba(200,180,255,0.6)" />
      </TouchableOpacity>

      <View style={s.content}>

        {/* Game badge */}
        <Animated.View style={[s.gameBadge, { borderColor: meta.border }, pulseStyle]}>
          <View style={s.gameBadgeInner}>
            <Animated.View style={[s.scanLine, scanStyle]} />
            <Text style={s.gameEmoji}>{meta.emoji}</Text>
          </View>
        </Animated.View>
        <Text style={s.gameTitle}>{meta.label}</Text>
        <Text style={s.gameTagline}>{meta.tagline}</Text>

        {/* Players row */}
        <View style={s.playersRow}>
          <PlayerSlot name={myName} label="You" ready theme={theme} />
          <View style={s.vs}><Text style={s.vsText}>VS</Text></View>
          <PlayerSlot name={opponentName} label="Opponent" ready={opponentReady} theme={theme} />
        </View>

        {/* Status */}
        {phase === 'creating' && (
          <View style={s.statusWrap}>
            <ActivityIndicator size="small" color="#a78bfa" />
            <Text style={s.statusText}>Setting up session{dots}</Text>
          </View>
        )}

        {phase === 'waiting' && !opponentReady && (
          <View style={s.statusWrap}>
            <View style={s.pingDot} />
            <Text style={s.statusText}>Waiting for opponent to join{dots}</Text>
          </View>
        )}

        {phase === 'waiting' && opponentReady && (
          <View style={s.statusWrap}>
            <Text style={[s.statusText, { color: '#4ade80' }]}>Both players ready!</Text>
          </View>
        )}

        {phase === 'launching' && (
          <View style={s.statusWrap}>
            <ActivityIndicator size="small" color="#4ade80" />
            <Text style={[s.statusText, { color: '#4ade80' }]}>Launching game...</Text>
          </View>
        )}

        {error ? (
          <Text style={s.errorText}>{error}</Text>
        ) : null}

        {/* Rules preview */}
        <View style={s.rulesCard}>
          <Text style={s.rulesTitle}>How to play</Text>
          {meta.rules.slice(0, 2).map((rule, i) => (
            <View key={i} style={s.ruleRow}>
              <View style={[s.ruleDot, { backgroundColor: meta.color }]} />
              <Text style={s.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>

        {/* Cancel */}
        <TouchableOpacity style={s.cancelBtn} onPress={cancelAndBack}>
          <Text style={s.cancelText}>Cancel & go back</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  gridLine: {
    position: 'absolute', left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(167,139,250,0.05)',
  },

  backBtn: { padding: 16, alignSelf: 'flex-start' },

  content: {
    flex: 1, alignItems: 'center', paddingHorizontal: 24,
    justifyContent: 'center', gap: 20,
  },

  gameBadge: {
    width: 110, height: 110,
    borderRadius: 55, borderWidth: 2,
    backgroundColor: 'rgba(167,139,250,0.08)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
  },
  gameBadgeInner: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0,
    height: 1.5, backgroundColor: 'rgba(167,139,250,0.4)',
  },
  gameEmoji: { fontSize: 36 },

  gameTitle:   { fontSize: 22, fontFamily: typography.fontBold, color: '#f0e8ff' },
  gameTagline: { fontSize: 13, fontFamily: typography.fontRegular, color: 'rgba(200,180,255,0.45)', marginTop: -8 },

  playersRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    paddingHorizontal: 8, gap: 8,
  },
  vs: { alignItems: 'center' },
  vsText: {
    fontSize: 18, fontFamily: typography.fontExtraBold,
    color: 'rgba(167,139,250,0.5)', letterSpacing: 2,
  },

  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pingDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#fbbf24',
  },
  statusText: {
    fontSize: 13, fontFamily: typography.fontMedium,
    color: 'rgba(200,180,255,0.55)',
  },
  errorText: {
    fontSize: 13, fontFamily: typography.fontRegular, color: '#f87171',
    textAlign: 'center',
  },

  rulesCard: {
    width: '100%', borderRadius: 16, padding: 16,
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.2)', gap: 8,
  },
  rulesTitle: {
    fontSize: 11, fontFamily: typography.fontSemiBold,
    color: 'rgba(167,139,250,0.5)', letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 4,
  },
  ruleRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ruleDot:  { width: 5, height: 5, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  ruleText: { flex: 1, fontSize: 13, fontFamily: typography.fontRegular, color: 'rgba(200,180,255,0.5)', lineHeight: 20 },

  cancelBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  cancelText: {
    fontSize: 13, fontFamily: typography.fontMedium,
    color: 'rgba(248,113,113,0.55)',
  },
})
