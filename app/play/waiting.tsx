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
// import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { GAME_META, type GameType } from '../../lib/games'
import { getInitials } from '../../lib/matching'
import NeuralBackground from '../../components/NeuralBackground'
import { client } from '../../lib/aws'
import { getCurrentUser } from 'aws-amplify/auth'

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
    return () => { channelRef.current && channelRef.current.unsubscribe() }
  }, [])

  const init = async () => {
    let user;
    try { user = await getCurrentUser() } catch {}
    if (!user) { setError('Not logged in'); return }
    setMyId(user.userId)

    // Fetch my name
    const { data: prof } = await client.models.Profile.get({ id: user.userId })
    setMyName(prof?.full_name ?? 'You')

    if (params.sessionId) {
      // Rejoining specific session (random match or resume)
      await joinSession(params.sessionId, user.userId)
    } else if (params.opponentId && params.opponentId !== 'faf-bot') {
      // Check if a waiting session already exists between these two users,
      // including sessions where the host hasn't set guest_id yet (chat challenge flow)
      const { data: existing } = await client.models.LiveGameSession.list({
        filter: {
          game_type: { eq: gt },
          // TODO: complex or/and filters
        }
      })
      const existingSession = existing && existing.length > 0 ? existing[0] : null;

      if (existingSession) {
        await joinSession(existingSession.id, user.userId)
      } else {
        await createSession(user.userId, params.opponentId)
      }
    } else {
      // Bot game — go straight in
      launchGame(null)
    }
  }

  const createSession = async (hostId: string, guestId: string) => {
    // For Trivia or Wordle, generate the secret/set immediately
    let initialState: any = {}
    if (gt === 'trivia') {
      const { pickUniqueQuestionIndices } = require('../../lib/triviaQuestions')
      initialState = { q_indices: await pickUniqueQuestionIndices(10) }
    } else if (gt === 'wordle') {
      // Pick a random word from the constant list in wordle.tsx (copied here or exported)
      // Since WORDS is local to wordle.tsx, I'll just pick one here manually or export it
      const WORDS = ['FLAME','BLAZE','SPARK','GRIND','SCORE','PHASE','FOCUS','BRAVE','CODED','DRAFT','ELITE','FRESH','GLARE','HASTE','INTEL','JUDGE','KNEEL','LOGIC','MIXER','NIGHT','ORBIT','PLACE','QUEST','RADAR','STEAM','TRAIN','UNITY','VOICE','WATCH','YIELD']
      initialState = { word: WORDS[Math.floor(Math.random() * WORDS.length)] }
    }

    const { data, errors: err } = await client.models.LiveGameSession.create({
        game_type: gt,
        host_id: hostId,
        guest_id: guestId,
        status: 'waiting',
        state: initialState
      })

    if (err || !data) { setError('Could not create session'); return }

    // Double check for race conditions (duplicate sessions)
    if (guestId) {
      const { data: duplicates } = await client.models.LiveGameSession.list({
        filter: {
          game_type: { eq: gt },
          // TODO: complex or/and filters
        }
      })

      if (duplicates && duplicates.length > 1) {
        // If ours is not the oldest one, delete ours and join the oldest one instead
        if (duplicates[0].id !== data.id) {
          await client.models.LiveGameSession.delete({ id: data.id })
          await joinSession(duplicates[0].id, hostId)
          return
        }
      }
    }

    setSessionId(data.id)
    setPhase('waiting')
    subscribeToSession(data.id, hostId)
  }

  const joinSession = async (sid: string, userId: string) => {
    // Check our role in this session
    const { data: sess, errors: fetchErr } = await client.models.LiveGameSession.get({ id: sid })

    if (fetchErr || !sess) { setError('Session not found'); return }

    setSessionId(sid)

    if (sess.host_id !== userId && (!sess.guest_id || sess.guest_id === userId) && sess.status === 'waiting') {
      // We are the guest joining — mark active so the host's
      // subscription fires and both players get the launchGame() call.
      const { errors: updateErr } = await client.models.LiveGameSession.update({ id: sid, guest_id: userId, status: 'active' })
      if (updateErr) { setError('Could not join session'); return }
      
      sess.guest_id = userId
      sess.status = 'active'
    } else if (sess.host_id === userId && sess.guest_id) {
      // Host is rejoining and guest is already present — ensure status is active
      await client.models.LiveGameSession.update({ id: sid, status: 'active' })
      sess.status = 'active'
      // Host already knows about guest — resolve opponent info immediately
      const { data: guestProf } = await client.models.Profile.get({ id: sess.guest_id })
      if (guestProf) setOpponentName(guestProf.full_name ?? 'Opponent')
      setOpponentReady(true)
    } else if (sess.status === 'active') {
      // Session is already active (both joined) — launch directly
      setPhase('launching')
      setTimeout(() => launchGame(sid), 800)
      return
    }

    // Subscribe and wait for active confirmation
    setPhase('waiting')
    subscribeToSession(sid, userId)

    // If both players are already set on the session, transition now
    if (sess.status === 'active' && sess.guest_id && sess.host_id) {
      setOpponentReady(true)
      setPhase('launching')
      setTimeout(() => launchGame(sid), 1200)
    }
  }

  const subscribeToSession = (sid: string, userId: string) => {
    // TODO: AWS Amplify Realtime
    /*
    const stale = supabase.getChannels().find(c => c.topic === `realtime:live-session-${sid}`)
    if (stale) supabase.removeChannel(stale)

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
          // Fetch partner name if not already set
          client.models.Profile.get({ id: partner })
            .then(({ data: p }) => {
              if (p?.full_name) setOpponentName(p.full_name)
            })
        }

        if (s.status === 'active' && s.guest_id && s.host_id) {
          // Both joined — launch
          setPhase('launching')
          setTimeout(() => launchGame(sid), 1200)
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setError('Connection error — please try again')
        }
      })
      */
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
      await client.models.LiveGameSession.update({ id: sessionId, status: 'finished' })
    }
    router.back()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[s.container, { backgroundColor: '#07070f' }]}>
      <NeuralBackground intensity="light" />

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
