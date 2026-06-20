/**
 * pool.tsx — 8-Ball Pool game for FAF
 *
 * Full pool table rendered with React Native Views (no SVG / Canvas).
 * Ball positions are absolute {x,y} px in felt-space.  The player taps
 * the table to aim, drags the power slider, then taps SHOOT.  The cue
 * ball is animated via RN Animated (JS thread) so we can run collision
 * checks mid-path.  Pocket animation uses per-ball scale values.
 * The bot reads current state through refs, previews its aim line for
 * ~900 ms, then fires the same pipeline.
 */

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated as RNAnimated,
  PanResponder,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
// supabase removed
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { recordGameResult } from '../../lib/games'
import { client, broadcastEvent, subscribeToChannel } from '../../lib/aws'
import { getCurrentUser } from 'aws-amplify/auth'

// ─── Table geometry ───────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window')

const RAIL_W  = 20           // wooden rail width (px)
const TABLE_W = SW - 32      // outer table width including rails
const TABLE_H = TABLE_W * 1.9
const FELT_W  = TABLE_W - RAIL_W * 2
const FELT_H  = TABLE_H - RAIL_W * 2

const POCKET_R    = 14       // visual pocket hole radius
const BALL_R      = 11       // all ball radii
const COLLISION_R = BALL_R * 2.1  // cue-path collision detection radius

// Six pocket centres in felt-space (0,0 = top-left of felt)
const POCKETS = [
  { x: POCKET_R,          y: POCKET_R },
  { x: FELT_W / 2,        y: 0 },
  { x: FELT_W - POCKET_R, y: POCKET_R },
  { x: POCKET_R,          y: FELT_H - POCKET_R },
  { x: FELT_W / 2,        y: FELT_H },
  { x: FELT_W - POCKET_R, y: FELT_H - POCKET_R },
]

// ─── Ball colours ─────────────────────────────────────────────────────────────

// Balls 1-7 (solids) and 9-15 (stripes) share the same colour palette
const BALL_COLORS = [
  '#f5c518', // 1 / 9  — yellow
  '#1e40af', // 2 / 10 — blue
  '#dc2626', // 3 / 11 — red
  '#7c3aed', // 4 / 12 — purple
  '#ea580c', // 5 / 13 — orange
  '#15803d', // 6 / 14 — dark green  (distinct from felt via lighter outline)
  '#7f1d1d', // 7 / 15 — maroon
]

// ─── Types ────────────────────────────────────────────────────────────────────

type BallKind = 'solid' | 'stripe' | 'eight'

type BallState = {
  id: number          // 1-15
  x: number           // felt-space centre x
  y: number           // felt-space centre y
  pocketed: boolean
  kind: BallKind
  color: string       // main colour
}

type Assignment = 'none' | 'solid' | 'stripe'
type Phase      = 'coin' | 'playing' | 'done'
type TurnStage  = 'aiming' | 'shooting' | 'bot_thinking' | 'bot_shooting'

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function euclidean(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)
}

/**
 * Returns the t value [0,1] along segment (sx,sy)→(ex,ey) where the
 * moving cue ball (radius BALL_R) first touches the static ball at (cx,cy)
 * with radius BALL_R.  Returns null when no intersection occurs.
 */
function segmentHitsCircle(
  sx: number, sy: number,
  ex: number, ey: number,
  cx: number, cy: number,
  r: number
): number | null {
  const dx = ex - sx, dy = ey - sy
  const fx = sx - cx, fy = sy - cy
  const a = dx * dx + dy * dy
  const b = 2 * (fx * dx + fy * dy)
  const c = fx * fx + fy * fy - r * r
  let disc = b * b - 4 * a * c
  if (disc < 0 || a === 0) return null
  disc = Math.sqrt(disc)
  const t1 = (-b - disc) / (2 * a)
  const t2 = (-b + disc) / (2 * a)
  if (t1 >= 0 && t1 <= 1) return t1
  if (t2 >= 0 && t2 <= 1) return t2
  return null
}

// ─── Initial layout ───────────────────────────────────────────────────────────

/** Standard 8-ball triangle rack — apex at (cx, apexY), 5 rows. */
function buildRack(): BallState[] {
  const cx      = FELT_W / 2
  const apexY   = FELT_H * 0.28
  const spacing = BALL_R * 2.35

  // Standard rack order — 8 in centre, stripes/solids alternated at sides
  const rackOrder: number[] = [1, 9, 2, 10, 3, 11, 8, 12, 4, 13, 5, 14, 6, 15, 7]

  const positions: { x: number; y: number }[] = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      positions.push({
        x: cx + (col - row / 2) * spacing,
        y: apexY + row * (spacing * 0.87),
      })
    }
  }

  return rackOrder.map((id, i) => {
    const kind: BallKind = id <= 7 ? 'solid' : id === 8 ? 'eight' : 'stripe'
    const colorIdx = kind === 'solid' ? id - 1 : kind === 'stripe' ? id - 9 : 0
    return {
      id,
      x: positions[i].x,
      y: positions[i].y,
      pocketed: false,
      kind,
      color: kind === 'eight' ? '#111111' : BALL_COLORS[colorIdx],
    }
  })
}

/** Cue ball at foot-third, horizontally centred. */
function buildCueBall() {
  return { x: FELT_W / 2, y: FELT_H * 0.76 }
}

// ─── Power slider width ───────────────────────────────────────────────────────

const SLIDER_W = 180

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const BOT_LABEL_DEFAULT = 'FAF Bot'

export default function PoolScreen() {
  const theme = useTheme()
  const { opponentName, opponentId, sessionId } = useLocalSearchParams<{ opponentName?: string, opponentId?: string, sessionId?: string }>()
  const botLabel = (opponentName as string | undefined) ?? BOT_LABEL_DEFAULT
  const user = useAuthStore(s => s.user)
  const myId = user?.id ?? ''

  // ── Game state ──────────────────────────────────────────────────────────────
  const [phase,      setPhase]      = useState<Phase>('coin')
  const [myTurn,     setMyTurn]     = useState(true)
  const [turnStage,  setTurnStage]  = useState<TurnStage>('aiming')
  const [balls,      setBalls]      = useState<BallState[]>(buildRack)
  const [cueBallPos, setCueBallPos] = useState(buildCueBall)
  const [myAssign,   setMyAssign]   = useState<Assignment>('none')
  const [botAssign,  setBotAssign]  = useState<Assignment>('none')
  const [winner,     setWinner]     = useState<'me' | 'bot' | null>(null)
  const [log,        setLog]        = useState<string[]>([])
  const [power,      setPower]      = useState(60)
  const [aimTarget,  setAimTarget]  = useState<{ x: number; y: number } | null>(null)
  const [oppAimLine, setOppAimLine] = useState<{ fx: number; fy: number; tx: number; ty: number } | null>(null)
  const [loading,    setLoading]    = useState(!!sessionId)

  const channelRef = useRef<any>(null)

  // ── Refs to avoid stale closures in bot logic ───────────────────────────────
  const ballsRef      = useRef(balls)
  const cueBallRef    = useRef(cueBallPos)
  const myAssignRef   = useRef<Assignment>('none')
  const botAssignRef  = useRef<Assignment>('none')
  const shootingRef   = useRef(false)
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  // doBotShotRef allows scheduleBotTurn (defined early) to always call the
  // latest version of doBotShot without a stale closure.
  const doBotShotRef  = useRef<() => void>(() => {})

  // Initial load & Realtime setup
  useEffect(() => {
    if (sessionId) {
      loadSession()
      subscribe()
    }
    return () => { channelRef.current && channelRef.current.unsubscribe() }
  }, [sessionId])

  const loadSession = async () => {
    try {
      const { data: sess } = await client.models.live_game_sessions.get({ id: sessionId as string })

      if (sess) {
        // Deterministic turn: host goes first
        const isHost = sess.host_id === myId
        setMyTurn(isHost)
        setPhase('playing')
        setTurnStage(isHost ? 'aiming' : 'bot_thinking')
        addLog(isHost ? 'You won the break!' : `${botLabel} is breaking!`)
      }
    } catch {
      // Non-fatal — fall through to single-player mode
    } finally {
      setLoading(false)
    }
  }

  const subscribe = () => {
    channelRef.current = subscribeToChannel(`game_room:${sessionId}`, (event, payload) => {
      if (event === 'move') {
        if (payload.type === 'AIM') {
          setOppAimLine({ fx: cueBallRef.current.x, fy: cueBallRef.current.y, tx: payload.x, ty: payload.y })
        } else if (payload.type === 'SHOT') {
          setOppAimLine(null)
          setTurnStage('bot_shooting')
          shakeTable(payload.power)
          fireShot(cueBallRef.current.x, cueBallRef.current.y, payload.tx, payload.ty, payload.power, (pocketedIds, cueFinal) => {
            pocketAnimation(pocketedIds, () => {
              shootingRef.current = false
              resolveShot(pocketedIds, cueFinal, true)
            })
          })
        }
      }
    })
  }

  // Keep refs in sync
  useEffect(() => { ballsRef.current = balls },        [balls])
  useEffect(() => { cueBallRef.current = cueBallPos }, [cueBallPos])
  useEffect(() => { myAssignRef.current = myAssign },  [myAssign])
  useEffect(() => { botAssignRef.current = botAssign },[botAssign])

  // ── Animated values ─────────────────────────────────────────────────────────

  // Cue ball position — RN Animated (JS thread) for mid-animation collision
  const cueBallAnim = useRef(
    new RNAnimated.ValueXY({ x: cueBallPos.x, y: cueBallPos.y })
  ).current

  // Per-ball pocket scale (0 = vanished)
  const pocketScales = useRef<Record<number, RNAnimated.Value>>(
    Object.fromEntries(
      [8, ...Array.from({ length: 15 }, (_, i) => i + 1)].map(id => [
        id,
        new RNAnimated.Value(1),
      ])
    )
  ).current

  // Reanimated: table shake + cue ball pulse ring
  const tableShake    = useSharedValue(0)
  const cuePulse      = useSharedValue(1)

  // ── Power slider ────────────────────────────────────────────────────────────

  const sliderX = useRef(new RNAnimated.Value((power / 100) * SLIDER_W)).current

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        // Flatten offset so move is relative to current position
        sliderX.extractOffset()
      },
      onPanResponderMove: (_, gestureState) => {
        // Clamp to [0, SLIDER_W] after applying offset in listener
        const raw = (sliderX as any)._offset + gestureState.dx
        const clamped = Math.max(0, Math.min(SLIDER_W, raw))
        sliderX.setValue(clamped - (sliderX as any)._offset)
        setPower(Math.round((clamped / SLIDER_W) * 100))
      },
      onPanResponderRelease: () => {
        sliderX.flattenOffset()
      },
    })
  ).current

  // ── Animations ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (myTurn && turnStage === 'aiming' && phase === 'playing') {
      cuePulse.value = withRepeat(
        withSequence(
          withTiming(1.18, { duration: 550 }),
          withTiming(1.0,  { duration: 550 })
        ),
        -1, true
      )
    } else {
      cuePulse.value = withTiming(1, { duration: 180 })
    }
  }, [myTurn, turnStage, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const tableShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tableShake.value }],
  }))
  const cuePulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cuePulse.value }],
  }))

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const addLog = useCallback((msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 5))
  }, [])

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  useEffect(() => () => clearTimer(), [])

  const shakeTable = useCallback((pwr: number) => {
    if (pwr < 35) return
    const m = pwr > 70 ? 7 : 4
    tableShake.value = withSequence(
      withTiming(-m,       { duration: 50 }),
      withTiming(m,        { duration: 50 }),
      withTiming(-m * 0.5, { duration: 50 }),
      withTiming(0,        { duration: 50 }),
    )
  }, [tableShake])

  // ── Coin toss ────────────────────────────────────────────────────────────────

  const handleCoinToss = () => {
    const iGoFirst = Math.random() > 0.5
    setMyTurn(iGoFirst)
    setPhase('playing')
    setTurnStage(iGoFirst ? 'aiming' : 'bot_thinking')
    addLog(iGoFirst ? 'You won the coin toss — break!' : `${botLabel} won — bot breaks!`)
    if (!iGoFirst) scheduleBotTurn(1800)
  }

  // ── Core shot pipeline ───────────────────────────────────────────────────────

  /**
   * Move the cue ball from (fromX,fromY) toward (toX,toY) at `pwr`%.
   * Calculates which balls land within the cue path and returns their IDs.
   * Animates the ball; calls `onDone` when animation finishes.
   */
  const fireShot = useCallback((
    fromX: number, fromY: number,
    toX: number,   toY: number,
    pwr: number,
    onDone: (pocketedIds: number[], cueFinal: { x: number; y: number }) => void
  ) => {
    const dx = toX - fromX
    const dy = toY - fromY
    const d  = Math.sqrt(dx * dx + dy * dy) || 1
    const ux = dx / d, uy = dy / d
    const travel = 50 + pwr * 3.0   // px

    const rawEndX = fromX + ux * travel
    const rawEndY = fromY + uy * travel
    const endX = Math.max(BALL_R, Math.min(FELT_W - BALL_R, rawEndX))
    const endY = Math.max(BALL_R, Math.min(FELT_H - BALL_R, rawEndY))

    // Collision detection — snapshot current balls from ref
    const pocketedIds: number[] = []
    for (const b of ballsRef.current) {
      if (b.pocketed) continue
      const t = segmentHitsCircle(fromX, fromY, endX, endY, b.x, b.y, COLLISION_R)
      if (t !== null) pocketedIds.push(b.id)
    }

    const duration = 100 + pwr * 4
    RNAnimated.timing(cueBallAnim, {
      toValue: { x: endX, y: endY },
      duration,
      useNativeDriver: false,
    }).start(() => {
      onDone(pocketedIds, { x: endX, y: endY })
    })
  }, [cueBallAnim])

  /**
   * Shrink pocketed balls to zero, then call done().
   */
  const pocketAnimation = useCallback((ids: number[], done: () => void) => {
    if (ids.length === 0) { done(); return }
    RNAnimated.parallel(
      ids.map(id =>
        RNAnimated.timing(pocketScales[id] ?? new RNAnimated.Value(1), {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        })
      )
    ).start(() => done())
  }, [pocketScales])

  /**
   * Apply game-logic after a shot resolves.  Reads assignments from refs
   * so this function is safe to call from both player and bot contexts.
   */
  const resolveShot = useCallback((
    pocketedIds: number[],
    cueFinal: { x: number; y: number },
    isBot: boolean
  ) => {
    const snap      = ballsRef.current
    const curMyA    = myAssignRef.current
    const curBotA   = botAssignRef.current

    let nextMyA  = curMyA
    let nextBotA = curBotA

    // Classify pocketed balls
    const pocketed    = snap.filter(b => pocketedIds.includes(b.id))
    const hadSolids   = pocketed.some(b => b.kind === 'solid')
    const hadStripes  = pocketed.some(b => b.kind === 'stripe')
    const hadEight    = pocketed.some(b => b.kind === 'eight')

    // ── Group assignment ──
    if (curMyA === 'none' && (hadSolids || hadStripes)) {
      if (!isBot) {
        nextMyA  = hadSolids  ? 'solid'  : 'stripe'
        nextBotA = hadSolids  ? 'stripe' : 'solid'
      } else {
        nextBotA = hadSolids  ? 'solid'  : 'stripe'
        nextMyA  = hadSolids  ? 'stripe' : 'solid'
      }
      setMyAssign(nextMyA)
      setBotAssign(nextBotA)
    }

    // Update balls state
    setBalls(prev => prev.map(b => pocketedIds.includes(b.id) ? { ...b, pocketed: true } : b))

    // Update cue ball
    setCueBallPos(cueFinal)
    cueBallAnim.setValue({ x: cueFinal.x, y: cueFinal.y })

    // ── 8-ball ──
    if (hadEight) {
      const shooterA  = isBot ? nextBotA : nextMyA
      // Check if shooter cleared their group first
      const groupLeft = snap.filter(b => b.kind === shooterA && !b.pocketed && !pocketedIds.includes(b.id))
      if (groupLeft.length > 0 || shooterA === 'none') {
        // Illegal — opponent wins
        const w = isBot ? 'me' : 'bot'
        addLog(isBot ? `${botLabel} sank 8-ball early — You win!` : 'You sank 8-ball early — Bot wins!')
        setWinner(w); setPhase('done')
        // Record result for real multiplayer
        if (sessionId && opponentId && opponentId !== 'faf-bot' && myId) {
          const winnerId = w === 'me' ? myId : opponentId
          recordGameResult('pool', opponentId, winnerId, { reason: 'early_eight' }).catch(() => {})
          client.models.LiveGameSession.update({ id: sessionId, status: 'finished', winner_id: winnerId }).then(() => {})
        }
      } else {
        const w = isBot ? 'bot' : 'me'
        addLog(isBot ? `${botLabel} sinks the 8-ball — Bot wins!` : 'You sink the 8-ball — You win!')
        setWinner(w); setPhase('done')
        // Record result for real multiplayer
        if (sessionId && opponentId && opponentId !== 'faf-bot' && myId) {
          const winnerId = w === 'me' ? myId : opponentId
          recordGameResult('pool', opponentId, winnerId, { reason: 'eight_ball' }).catch(() => {})
          client.models.LiveGameSession.update({ id: sessionId, status: 'finished', winner_id: winnerId }).then(() => {})
        }
      }
      return
    }

    // ── Normal pocketing ──
    const shooterA   = isBot ? nextBotA : nextMyA
    const legalBalls = pocketed.filter(b => b.kind === shooterA)
    const foulBalls  = pocketed.filter(b => b.kind !== shooterA && b.kind !== 'eight')

    let continuesTurn = false
    let foul          = false

    if (pocketedIds.length === 0) {
      addLog(isBot ? `${botLabel} missed — your turn!` : 'Miss — bot\'s turn!')
    } else if (foulBalls.length > 0 && shooterA !== 'none') {
      foul = true
      addLog(isBot ? `${botLabel} fouled — your turn!` : `Foul! Wrong ball — bot's turn!`)
    } else if (legalBalls.length > 0) {
      continuesTurn = true
      const ids = legalBalls.map(b => b.id).join(', ')
      addLog(isBot
        ? `${botLabel} pockets ${ids}`
        : `You pocket ${ids}`)
    } else {
      addLog(isBot ? `${botLabel} missed — your turn!` : 'Miss — bot\'s turn!')
    }

    // ── Turn transition ──
    const passTurn = foul || !continuesTurn

    if (passTurn) {
      if (isBot) {
        setMyTurn(true); setTurnStage('aiming')
      } else {
        setMyTurn(false); setTurnStage('bot_thinking')
        scheduleBotTurn(1900)
      }
    } else {
      // Same player continues
      if (isBot) {
        setTurnStage('bot_thinking')
        scheduleBotTurn(1500)
      } else {
        setMyTurn(true); setTurnStage('aiming')
      }
    }
  }, [addLog, botLabel, cueBallAnim]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Player shot ──────────────────────────────────────────────────────────────

  const handleShoot = useCallback(() => {
    if (!myTurn || turnStage !== 'aiming' || !aimTarget || shootingRef.current) return
    shootingRef.current = true
    setTurnStage('shooting')
    setAimTarget(null)
    shakeTable(power)

    const { x: fx, y: fy } = cueBallRef.current

    fireShot(fx, fy, aimTarget.x, aimTarget.y, power, (pocketedIds, cueFinal) => {
      pocketAnimation(pocketedIds, () => {
        shootingRef.current = false
        resolveShot(pocketedIds, cueFinal, false)
      })
    })
  }, [myTurn, turnStage, aimTarget, power, shakeTable, fireShot, pocketAnimation, resolveShot])

  // ── Bot shot ─────────────────────────────────────────────────────────────────

  const scheduleBotTurn = (delay: number) => {
    if (sessionId) return // No bot in multiplayer
    clearTimer()
    timerRef.current = setTimeout(() => doBotShotRef.current(), delay)
  }

  const doBotShot = useCallback(() => {
    setTurnStage('bot_shooting')
    shootingRef.current = true

    // Read live state from refs — no stale closure
    const snap     = ballsRef.current
    const cue      = cueBallRef.current
    const botA     = botAssignRef.current

    const remaining = snap.filter(b => !b.pocketed)

    let target: BallState | null = null

    if (botA !== 'none') {
      const group = remaining.filter(b => b.kind === botA)
      if (group.length === 0) {
        target = remaining.find(b => b.kind === 'eight') ?? null
      } else {
        target = group.reduce((closest, b) =>
          euclidean(cue.x, cue.y, b.x, b.y) < euclidean(cue.x, cue.y, closest.x, closest.y) ? b : closest
        )
      }
    } else {
      // Groups unassigned — pick a random non-eight ball
      const nonEight = remaining.filter(b => b.kind !== 'eight')
      if (nonEight.length > 0) {
        target = nonEight[Math.floor(Math.random() * nonEight.length)]
      }
    }

    if (!target) {
      shootingRef.current = false
      setMyTurn(true); setTurnStage('aiming')
      return
    }

    // 30% chance of intentional miss offset
    const misses  = Math.random() < 0.30
    const aimX    = target.x + (misses ? (Math.random() - 0.5) * BALL_R * 5 : 0)
    const aimY    = target.y + (misses ? (Math.random() - 0.5) * BALL_R * 5 : 0)
    const botPwr  = 55 + Math.floor(Math.random() * 25)  // 55-80%

    // Show bot aim line for ~850 ms
    setOppAimLine({ fx: cue.x, fy: cue.y, tx: aimX, ty: aimY })

    timerRef.current = setTimeout(() => {
      setOppAimLine(null)
      shakeTable(botPwr)

      fireShot(cue.x, cue.y, aimX, aimY, botPwr, (pocketedIds, cueFinal) => {
        pocketAnimation(pocketedIds, () => {
          shootingRef.current = false
          resolveShot(pocketedIds, cueFinal, true)
        })
      })
    }, 860)
  }, [shakeTable, fireShot, pocketAnimation, resolveShot])

  // Keep the ref in sync so scheduleBotTurn always calls the latest version
  doBotShotRef.current = doBotShot

  // ── Table tap ─────────────────────────────────────────────────────────────────

  const handleTableTap = useCallback((evt: any) => {
    if (!myTurn || turnStage !== 'aiming') return
    const { locationX, locationY } = evt.nativeEvent
    setAimTarget({ x: locationX, y: locationY })

    // Broadcast aim
    if (channelRef.current) {
      broadcastEvent('game_room:' + sessionId, 'move', { type: 'AIM', x: locationX, y: locationY })
    }
  }, [myTurn, turnStage])

  // ── Derived values ────────────────────────────────────────────────────────────

  const remaining    = balls.filter(b => !b.pocketed)
  const myBallsLeft  = myAssign  === 'none' ? 7 : remaining.filter(b => b.kind === myAssign).length
  const botBallsLeft = botAssign === 'none' ? 7 : remaining.filter(b => b.kind === botAssign).length
  const eightOnTable = remaining.some(b => b.kind === 'eight')
  const isBotTurn    = !myTurn

  // Aim line geometry (angle from cue ball centre)
  let aimLen = 0, aimAngle = 0
  if (aimTarget) {
    const dx = aimTarget.x - cueBallPos.x
    const dy = aimTarget.y - cueBallPos.y
    aimLen   = Math.sqrt(dx * dx + dy * dy)
    aimAngle = Math.atan2(dy, dx) * (180 / Math.PI)
  }

  // Opponent aim line geometry
  let oppLen = 0, oppAngle = 0
  if (oppAimLine) {
    const dx = oppAimLine.tx - oppAimLine.fx
    const dy = oppAimLine.ty - oppAimLine.fy
    oppLen   = Math.sqrt(dx * dx + dy * dy)
    oppAngle = Math.atan2(dy, dx) * (180 / Math.PI)
  }

  // ── Status text ───────────────────────────────────────────────────────────────

  const statusText = (() => {
    if (turnStage === 'bot_thinking') return `${botLabel} is lining up...`
    if (turnStage === 'bot_shooting') return `${botLabel} shoots!`
    if (turnStage === 'shooting')     return 'Shot in progress...'
    if (isBotTurn)                    return `${botLabel}'s turn`
    if (myAssign === 'none')          return 'Tap the table to aim — first pot assigns your group'
    if (myBallsLeft === 0)            return 'Pocket cleared! Sink the 8-ball!'
    const g = myAssign === 'solid' ? 'Solids' : 'Stripes'
    return `Your turn (${g}) — ${myBallsLeft} ball${myBallsLeft !== 1 ? 's' : ''} left`
  })()

  // ─── COIN SCREEN ─────────────────────────────────────────────────────────────

  if (phase === 'coin') {
    return (
      <SafeAreaView style={[gs.flex, { backgroundColor: theme.bg }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[gs.backAbs, { borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>

        <View style={gs.centreScreen}>
          {/* Mini table preview */}
          <View style={[gs.previewOuter, { backgroundColor: '#5C2E0A' }]}>
            <View style={[gs.previewFelt, { backgroundColor: '#166534' }]}>
              {PREVIEW_POCKETS.map((pos, i) => (
                <View key={i} style={[gs.previewPocket, pos, { backgroundColor: '#080808' }]} />
              ))}
              <View style={gs.previewEight}>
                <Text style={gs.previewEightText}>8</Text>
              </View>
            </View>
          </View>

          <Text style={[gs.coinTitle, { color: theme.text }]}>8-Ball Pool</Text>
          <Text style={[gs.coinSub,   { color: theme.textMuted }]}>You vs {botLabel}</Text>

          <View style={gs.ruleList}>
            {[
              'Pocket all your group, then sink the 8-ball to win',
              'Potting the 8-ball early = instant loss',
              'Wrong group ball = foul (turn passes)',
            ].map((rule, i) => (
              <View key={i} style={gs.ruleRow}>
                <View style={[gs.ruleDot, { backgroundColor: theme.accent }]} />
                <Text style={[gs.ruleText, { color: theme.textMuted }]}>{rule}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[gs.coinBtn, { backgroundColor: theme.accent }]}
            onPress={handleCoinToss}
            activeOpacity={0.85}>
            <Text style={gs.coinBtnText}>Flip Coin to Start</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ─── DONE SCREEN ─────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const win = winner === 'me'
    return (
      <SafeAreaView style={[gs.flex, { backgroundColor: theme.bg }]}>
        <View style={gs.centreScreen}>
          <View style={[gs.trophyCircle, {
            backgroundColor: win ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.12)',
          }]}>
            <Text style={[gs.trophyLetter, { color: win ? '#34d399' : '#f87171' }]}>
              {win ? 'W' : 'L'}
            </Text>
          </View>

          <Text style={[gs.doneTitle, { color: theme.text }]}>
            {win ? 'You Win!' : `${botLabel} Wins!`}
          </Text>
          <Text style={[gs.doneSub, { color: theme.textMuted }]}>
            {win ? 'Great game — you cleared the table!' : 'Better luck next time!'}
          </Text>

          <View style={[gs.doneCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={gs.doneRow}>
              <DonePlayer
                name="You"
                group={myAssign}
                ballsLeft={myBallsLeft}
                isWinner={win}
                accentColor={theme.success}
                loserColor={theme.danger}
              />
              <Text style={[gs.doneVs, { color: theme.textFaint }]}>vs</Text>
              <DonePlayer
                name={botLabel}
                group={botAssign}
                ballsLeft={botBallsLeft}
                isWinner={!win}
                accentColor={theme.success}
                loserColor={theme.danger}
                alignRight
              />
            </View>
          </View>

          <TouchableOpacity
            style={[gs.primaryBtn, { backgroundColor: theme.accent }]}
            onPress={() => router.back()}
            activeOpacity={0.85}>
            <Text style={gs.primaryBtnText}>Back to Lobby</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[gs.secondaryBtn, { borderColor: theme.border }]}
            onPress={() => router.replace('/play/pool' as any)}
            activeOpacity={0.85}>
            <Text style={[gs.secondaryBtnText, { color: theme.accent }]}>Play Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ─── PLAYING SCREEN ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[gs.flex, { backgroundColor: theme.bg }]} edges={['top']}>

      {/* ── Header ── */}
      <View style={gs.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[gs.backBtn, { borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <Text style={[gs.headerTitle, { color: theme.text }]}>8-Ball Pool</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* ── Scoreboard ── */}
      <View style={[gs.scoreboard, { backgroundColor: theme.card, borderColor: theme.border }]}>

        {/* Player side */}
        <View style={gs.scoreSlot}>
          {myTurn && <View style={[gs.activeDot, gs.activeDotL, { backgroundColor: theme.accent }]} />}
          <Text style={[gs.scoreName, { color: myTurn ? theme.accent : theme.textMuted }]}>You</Text>
          <Text style={[gs.scoreGroup, { color: theme.textFaint }]}>
            {myAssign === 'none' ? '—' : myAssign === 'solid' ? 'Solids' : 'Stripes'}
          </Text>
          <View style={gs.miniDots}>
            {renderMiniDots(myAssign, myBallsLeft)}
          </View>
        </View>

        {/* Centre */}
        <View style={gs.scoreCenter}>
          <Text style={[gs.scoreVs, { color: theme.textFaint }]}>vs</Text>
          <View style={[gs.eightIndicator, { opacity: eightOnTable ? 1 : 0.25 }]}>
            <Text style={gs.eightIndicatorText}>8</Text>
          </View>
        </View>

        {/* Bot side */}
        <View style={[gs.scoreSlot, gs.scoreSlotR]}>
          {isBotTurn && <View style={[gs.activeDot, gs.activeDotR, { backgroundColor: '#f87171' }]} />}
          <Text style={[gs.scoreName, { color: isBotTurn ? '#f87171' : theme.textMuted }]}>{botLabel}</Text>
          <Text style={[gs.scoreGroup, { color: theme.textFaint }]}>
            {botAssign === 'none' ? '—' : botAssign === 'solid' ? 'Solids' : 'Stripes'}
          </Text>
          <View style={[gs.miniDots, gs.miniDotsR]}>
            {renderMiniDots(botAssign, botBallsLeft)}
          </View>
        </View>
      </View>

      {/* ── Status strip ── */}
      <View style={[gs.statusStrip, {
        backgroundColor: myTurn ? theme.accentBg : 'rgba(248,113,113,0.1)',
        borderColor:     myTurn ? theme.accentBorder : 'rgba(248,113,113,0.25)',
      }]}>
        <Text style={[gs.statusText, { color: myTurn ? theme.accent : '#f87171' }]} numberOfLines={1}>
          {statusText}
        </Text>
      </View>

      {/* ── Pool Table ── */}
      <Animated.View style={[gs.tableOuter, tableShakeStyle]}>
        {/* Rail edge highlights — top light, bottom shadow */}
        <View style={[gs.railEdge, gs.railTop]} />
        <View style={[gs.railEdge, gs.railBottom]} />
        <View style={[gs.railEdge, gs.railLeft]} />
        <View style={[gs.railEdge, gs.railRight]} />

        {/* Felt — tap target for aiming */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleTableTap}
          style={gs.felt}>

          {/* Felt texture (subtle cross-hatch) */}
          <View style={[gs.feltLine, gs.feltH, { top: FELT_H * 0.5 }]} />
          <View style={[gs.feltLine, gs.feltV, { left: FELT_W * 0.5 }]} />

          {/* Table spots */}
          <View style={[gs.spot, { left: FELT_W / 2 - 3, top: FELT_H * 0.25 - 3 }]} />
          <View style={[gs.spot, { left: FELT_W / 2 - 3, top: FELT_H * 0.5  - 3 }]} />
          <View style={[gs.spot, { left: FELT_W / 2 - 3, top: FELT_H * 0.75 - 3 }]} />

          {/* Baulk line */}
          <View style={[gs.baulkLine, { top: FELT_H * 0.75 }]} />

          {/* ── Pockets ── */}
          {POCKETS.map((p, i) => (
            <View key={i} style={[gs.pocket, {
              left: p.x - POCKET_R,
              top:  p.y - POCKET_R,
              width:  POCKET_R * 2,
              height: POCKET_R * 2,
              borderRadius: POCKET_R,
            }]}>
              {/* Inner pocket shadow ring */}
              <View style={gs.pocketInner} />
            </View>
          ))}

          {/* ── Player aim line ── */}
          {aimTarget && myTurn && turnStage === 'aiming' && aimLen > 0 && (
            <AimLine
              fromX={cueBallPos.x}
              fromY={cueBallPos.y}
              len={aimLen}
              angle={aimAngle}
              color="rgba(255,255,255,0.6)"
              dotColor="rgba(255,255,255,0.75)"
            />
          )}

          {/* ── Opponent aim line ── */}
          {oppAimLine && oppLen > 0 && (
            <AimLine
              fromX={oppAimLine.fx}
              fromY={oppAimLine.fy}
              len={oppLen}
              angle={oppAngle}
              color="rgba(248,113,113,0.55)"
              dotColor="rgba(248,113,113,0.8)"
            />
          )}

          {/* ── Balls (1-15) ── */}
          {balls.map(ball => {
            if (ball.pocketed) return null
            const isStripe = ball.kind === 'stripe'
            const numColor =
              ball.color === '#f5c518' ? '#111' :   // yellow — dark number
              ball.kind === 'eight'    ? '#fff' : '#fff'

            return (
              <RNAnimated.View
                key={ball.id}
                style={[gs.ball, {
                  left:            ball.x - BALL_R,
                  top:             ball.y - BALL_R,
                  backgroundColor: isStripe ? '#efefef' : ball.color,
                  transform: [{ scale: pocketScales[ball.id] ?? 1 }],
                }]}>
                {/* Stripe band */}
                {isStripe && (
                  <View style={[gs.stripeBand, { backgroundColor: ball.color }]} />
                )}
                {/* Gloss */}
                <View style={gs.ballGloss} />
                {/* Number */}
                <Text style={[gs.ballNum, { color: numColor, zIndex: 3 }]}>
                  {ball.id}
                </Text>
              </RNAnimated.View>
            )
          })}

          {/* ── Cue ball ── */}
          <RNAnimated.View style={[gs.cueBall, {
            left: cueBallAnim.x.interpolate({
              inputRange: [-1e5, 1e5],
              outputRange: [-1e5 - BALL_R, 1e5 - BALL_R],
            }),
            top: cueBallAnim.y.interpolate({
              inputRange: [-1e5, 1e5],
              outputRange: [-1e5 - BALL_R, 1e5 - BALL_R],
            }),
          }]}>
            <View style={gs.cueBallGloss} />
            {/* Pulse ring while aiming */}
            {myTurn && turnStage === 'aiming' && (
              <Animated.View style={[gs.pulseRing, cuePulseStyle]} />
            )}
          </RNAnimated.View>

        </TouchableOpacity>
      </Animated.View>

      {/* ── Player controls ── */}
      {myTurn && (
        <View style={[gs.controls, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[gs.controlHint, { color: theme.textMuted }]}>
            {aimTarget ? 'Aim set — adjust power and shoot' : 'Tap anywhere on the table to aim'}
          </Text>

          {/* Power slider */}
          <View style={gs.sliderRow}>
            <Text style={[gs.sliderLabel, { color: theme.textFaint }]}>PWR</Text>
            <View
              style={[gs.sliderTrack, { backgroundColor: theme.card2 }]}
              {...panResponder.panHandlers}>
              <RNAnimated.View style={[gs.sliderFill, {
                width: sliderX,
                backgroundColor: power > 72 ? '#ef4444' : power > 45 ? '#f97316' : theme.accent,
              }]} />
              <RNAnimated.View style={[gs.sliderThumb, {
                left: sliderX,
                backgroundColor: power > 72 ? '#ef4444' : power > 45 ? '#f97316' : theme.accent,
              }]} />
            </View>
            <Text style={[gs.sliderPct, { color: theme.text }]}>{power}%</Text>
          </View>

          {/* Shoot button */}
          <TouchableOpacity
            onPress={handleShoot}
            disabled={!aimTarget || turnStage !== 'aiming'}
            activeOpacity={0.85}
            style={[gs.shootBtn, {
              backgroundColor: aimTarget ? theme.accent : 'rgba(255,255,255,0.06)',
              opacity: aimTarget ? 1 : 0.45,
            }]}>
            <Text style={[gs.shootBtnText, { color: aimTarget ? '#fff' : theme.textFaint }]}>
              SHOOT
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bot thinking strip */}
      {isBotTurn && (
        <View style={[gs.controls, { backgroundColor: theme.card, borderColor: theme.border, alignItems: 'center', paddingVertical: 14 }]}>
          <Text style={[gs.botThinking, { color: '#f87171' }]}>
            {turnStage === 'bot_thinking' ? `${botLabel} is thinking...` : `${botLabel} is shooting...`}
          </Text>
        </View>
      )}

      {/* ── Shot log ── */}
      <View style={[gs.logBox, { backgroundColor: theme.card2, borderColor: theme.border }]}>
        {log.length === 0
          ? <Text style={[gs.logEntry, { color: theme.textFaint }]}>Shot log will appear here...</Text>
          : log.map((entry, i) => (
            <Text key={i}
              numberOfLines={1}
              style={[gs.logEntry, {
                color:      i === 0 ? theme.text : theme.textFaint,
                fontFamily: i === 0 ? typography.fontMedium : typography.fontRegular,
              }]}>
              {entry}
            </Text>
          ))
        }
      </View>

    </SafeAreaView>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Renders a dotted aim line from (fromX, fromY) at the given angle and length.
 *
 * RN does not support `transformOrigin`, so we cannot rotate a full-width View
 * from its left edge.  Instead we use a horizontal container whose left edge is
 * at the cue ball centre, then compensate for the Y offset so the rotation
 * pivot is the midpoint of the left edge:
 *   translateX = 0 (already at fromX)
 *   translateY = -height/2 + 1  (centre vertically)
 *   rotate  (pivots around centre of the view, i.e. aimLen/2 from the left)
 *
 * To make the rotation pivot the LEFT edge instead, we shift the whole view
 * right by aimLen/2 so the centre of the RN view aligns with the left end of
 * the intended line, then shift it back after rotation — but that gets messy
 * across different aimLen values.
 *
 * Simpler approach: render the dashes using absolute positions along the
 * un-rotated line, then rotate the whole container.  We accept the pivot-at-
 * centre behaviour by starting the dashes at -aimLen/2 and rendering them
 * from -aimLen/2 to aimLen/2 so the visible left end is at the cue ball.
 * We place the container centred at the midpoint of the line:
 *   cx = fromX + cos(angle) * aimLen/2
 *   cy = fromY + sin(angle) * aimLen/2
 */
function AimLine({
  fromX, fromY, len, angle, color, dotColor,
}: {
  fromX: number; fromY: number
  len: number; angle: number
  color: string; dotColor: string
}) {
  const rad = angle * (Math.PI / 180)
  const midX = fromX + Math.cos(rad) * len / 2
  const midY = fromY + Math.sin(rad) * len / 2

  const dashCount = Math.ceil(len / 10)

  return (
    <>
      {/* Dashed line container centred at midpoint of the line */}
      <View style={{
        position: 'absolute',
        left:     midX - len / 2,
        top:      midY - 1,
        width:    len,
        height:   2,
        transform: [{ rotate: `${angle}deg` }],
        overflow: 'hidden',
      }}>
        {Array.from({ length: dashCount }).map((_, di) => (
          <View key={di} style={{
            position:        'absolute',
            left:            di * 10,
            top:             0,
            width:           6,
            height:          2,
            backgroundColor: color,
          }} />
        ))}
      </View>

      {/* Dot at aim target */}
      <View style={{
        position:        'absolute',
        left:            fromX + Math.cos(rad) * len - 5,
        top:             fromY + Math.sin(rad) * len - 5,
        width:           10,
        height:          10,
        borderRadius:    5,
        backgroundColor: dotColor,
      }} />
    </>
  )
}

/** Score panel for game-over screen. */
function DonePlayer({
  name, group, ballsLeft, isWinner, accentColor, loserColor, alignRight = false,
}: {
  name: string
  group: Assignment
  ballsLeft: number
  isWinner: boolean
  accentColor: string
  loserColor: string
  alignRight?: boolean
}) {
  const groupLabel = group === 'none' ? '—' : group === 'solid' ? 'Solids' : 'Stripes'
  const score      = isWinner ? '7/7' : `${7 - ballsLeft}/7`
  return (
    <View style={{ alignItems: alignRight ? 'flex-end' : 'flex-start', gap: 3 }}>
      <Text style={{ fontSize: 13, fontFamily: typography.fontMedium, color: 'rgba(240,240,255,0.55)' }}>{name}</Text>
      <Text style={{ fontSize: 11, fontFamily: typography.fontRegular, color: 'rgba(240,240,255,0.3)' }}>{groupLabel}</Text>
      <Text style={{ fontSize: 30, fontFamily: typography.fontBold, color: isWinner ? accentColor : loserColor }}>{score}</Text>
    </View>
  )
}

/** 7 mini coloured dots showing how many balls remain. */
function renderMiniDots(assign: Assignment, ballsLeft: number) {
  return Array.from({ length: 7 }).map((_, i) => {
    const filled  = i < ballsLeft
    const bg      = assign === 'none'
      ? 'rgba(255,255,255,0.14)'
      : filled
        ? BALL_COLORS[i]
        : 'rgba(255,255,255,0.08)'
    return (
      <View key={i} style={[gs.miniDot, {
        backgroundColor: bg,
        borderWidth:  assign === 'stripe' && filled ? 1 : 0,
        borderColor:  'rgba(255,255,255,0.4)',
      }]} />
    )
  })
}

// ─── Preview pocket positions (coin screen) ───────────────────────────────────

const PREVIEW_POCKETS: Array<Record<string, number | string>> = [
  { position: 'absolute', left: 5,    top: 5    },
  { position: 'absolute', left: '50%' as any, top: 2, marginLeft: -6 },
  { position: 'absolute', right: 5,   top: 5    },
  { position: 'absolute', left: 5,    bottom: 5 },
  { position: 'absolute', left: '50%' as any, bottom: 2, marginLeft: -6 },
  { position: 'absolute', right: 5,   bottom: 5 },
]

// ─── Styles ───────────────────────────────────────────────────────────────────

const gs = StyleSheet.create({
  flex: { flex: 1 },

  // ── Coin / Done shared centre layout ──
  centreScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  backAbs: {
    position: 'absolute', top: 56, left: 16, zIndex: 20,
    width: 36, height: 36, borderRadius: 18, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Coin screen ──
  previewOuter: {
    width: 110, height: 170,
    borderRadius: 10, padding: 10,
    marginBottom: 6,
  },
  previewFelt: {
    flex: 1, borderRadius: 5,
    position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  previewPocket: {
    width: 12, height: 12, borderRadius: 6,
  },
  previewEight: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
  },
  previewEightText: {
    fontSize: 12, fontFamily: typography.fontBold, color: '#fff',
  },
  coinTitle:   { fontSize: 26, fontFamily: typography.fontBold },
  coinSub:     { fontSize: 14, fontFamily: typography.fontRegular },
  ruleList:    { gap: 8, alignSelf: 'stretch', marginTop: 4 },
  ruleRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleDot:     { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  ruleText:    { fontSize: 13, fontFamily: typography.fontRegular, flex: 1 },
  coinBtn: {
    borderRadius: 24, paddingHorizontal: 40, paddingVertical: 14,
    marginTop: 8,
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  coinBtnText: { fontSize: 16, fontFamily: typography.fontBold, color: '#fff' },

  // ── Done screen ──
  trophyCircle: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
  },
  trophyLetter: { fontSize: 32, fontFamily: typography.fontBold },
  doneTitle:    { fontSize: 26, fontFamily: typography.fontBold },
  doneSub:      { fontSize: 14, fontFamily: typography.fontRegular, textAlign: 'center' },
  doneCard: {
    borderRadius: 20, borderWidth: 0.5, padding: 20,
    alignSelf: 'stretch', marginTop: 6,
  },
  doneRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-around',
  },
  doneVs: { fontSize: 14, fontFamily: typography.fontRegular },
  primaryBtn: {
    borderRadius: 20, paddingVertical: 14,
    alignSelf: 'stretch', alignItems: 'center',
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  primaryBtnText: { fontSize: 15, fontFamily: typography.fontBold, color: '#fff' },
  secondaryBtn: {
    borderRadius: 20, paddingVertical: 14,
    alignSelf: 'stretch', alignItems: 'center', borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15, fontFamily: typography.fontSemiBold },

  // ── Playing header ──
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontFamily: typography.fontBold },

  // ── Scoreboard ──
  scoreboard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, borderRadius: 16, borderWidth: 0.5,
    padding: 10, marginBottom: 6,
  },
  scoreSlot:  { flex: 1, alignItems: 'flex-start', paddingLeft: 8, gap: 2, position: 'relative' },
  scoreSlotR: { alignItems: 'flex-end', paddingLeft: 0, paddingRight: 8 },
  activeDot:  { position: 'absolute', top: 2, width: 6, height: 6, borderRadius: 3 },
  activeDotL: { left: 2 },
  activeDotR: { right: 2 },
  scoreName:  { fontSize: 12, fontFamily: typography.fontSemiBold },
  scoreGroup: { fontSize: 10, fontFamily: typography.fontRegular },
  miniDots:   { flexDirection: 'row', gap: 2 },
  miniDotsR:  { justifyContent: 'flex-end' },
  miniDot:    { width: 7, height: 7, borderRadius: 4 },
  scoreCenter: { alignItems: 'center', gap: 4, paddingHorizontal: 10 },
  scoreVs:    { fontSize: 11, fontFamily: typography.fontRegular },
  eightIndicator: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  eightIndicatorText: { fontSize: 10, fontFamily: typography.fontBold, color: '#fff' },

  // ── Status strip ──
  statusStrip: {
    marginHorizontal: 16, borderRadius: 10, borderWidth: 0.5,
    paddingVertical: 5, paddingHorizontal: 12,
    marginBottom: 8, minHeight: 28, justifyContent: 'center',
  },
  statusText: { fontSize: 12, fontFamily: typography.fontMedium, textAlign: 'center' },

  // ── Table outer (rail) ──
  tableOuter: {
    width: TABLE_W, height: TABLE_H,
    alignSelf: 'center',
    backgroundColor: '#6B3A2A',
    borderColor: '#3d1f10',
    borderWidth: 3,
    borderRadius: 14,
    padding: RAIL_W,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 18,
    elevation: 16,
    position: 'relative',
  },
  railEdge: { position: 'absolute' },
  railTop: {
    top: 0, left: 0, right: 0, height: RAIL_W,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    backgroundColor: 'rgba(255,210,120,0.12)',
  },
  railBottom: {
    bottom: 0, left: 0, right: 0, height: RAIL_W,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  railLeft: {
    top: RAIL_W, bottom: RAIL_W, left: 0, width: RAIL_W,
    backgroundColor: 'rgba(255,210,120,0.06)',
  },
  railRight: {
    top: RAIL_W, bottom: RAIL_W, right: 0, width: RAIL_W,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },

  // ── Felt ──
  felt: {
    flex: 1,
    backgroundColor: '#15803d',
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  feltLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.05)' },
  feltH:    { left: 0, right: 0, height: 1 },
  feltV:    { top: 0, bottom: 0, width: 1 },
  baulkLine: {
    position: 'absolute', left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  spot: {
    position: 'absolute',
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // ── Pockets ──
  pocket: {
    position: 'absolute',
    backgroundColor: '#050505',
    zIndex: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  pocketInner: {
    width: POCKET_R * 1.1,
    height: POCKET_R * 1.1,
    borderRadius: POCKET_R * 0.55,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // ── Ball ──
  ball: {
    position: 'absolute',
    width: BALL_R * 2, height: BALL_R * 2,
    borderRadius: BALL_R,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 3,
    elevation: 4,
    overflow: 'hidden',
  },
  stripeBand: {
    position: 'absolute',
    left: 0, right: 0,
    top: BALL_R * 0.28,
    height: BALL_R * 0.9,
  },
  ballGloss: {
    position: 'absolute',
    top: 2, left: 3,
    width: BALL_R * 0.65,
    height: BALL_R * 0.42,
    borderRadius: BALL_R * 0.3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  ballNum: {
    fontSize: 8,
    fontFamily: typography.fontBold,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1,
  },

  // ── Cue ball ──
  cueBall: {
    position: 'absolute',
    width: BALL_R * 2, height: BALL_R * 2,
    borderRadius: BALL_R,
    backgroundColor: '#f5f5f5',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
    overflow: 'visible',
    zIndex: 20,
  },
  cueBallGloss: {
    position: 'absolute',
    top: 2, left: 3,
    width: BALL_R * 0.65,
    height: BALL_R * 0.42,
    borderRadius: BALL_R * 0.3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  pulseRing: {
    position: 'absolute',
    top: -5, left: -5,
    right: -5, bottom: -5,
    borderRadius: BALL_R + 5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },

  // ── Controls ──
  controls: {
    marginHorizontal: 16, borderRadius: 14, borderWidth: 0.5,
    padding: 12, marginTop: 8, gap: 8,
  },
  controlHint: { fontSize: 11, fontFamily: typography.fontRegular, textAlign: 'center' },
  sliderRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderLabel: { fontSize: 10, fontFamily: typography.fontBold, width: 28 },
  sliderTrack: {
    flex: 1, height: 8, borderRadius: 4,
    position: 'relative', overflow: 'visible',
  },
  sliderFill: {
    position: 'absolute', left: 0, top: 0,
    height: 8, borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    width: 18, height: 18, borderRadius: 9,
    top: -5, marginLeft: -9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  sliderPct:   { fontSize: 12, fontFamily: typography.fontBold, width: 36, textAlign: 'right' },
  shootBtn:    { borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  shootBtnText:{ fontSize: 14, fontFamily: typography.fontBold, letterSpacing: 2 },
  botThinking: { fontSize: 13, fontFamily: typography.fontMedium },

  // ── Log ──
  logBox: {
    marginHorizontal: 16, borderRadius: 10, borderWidth: 0.5,
    padding: 8, marginTop: 6, gap: 2, minHeight: 24,
  },
  logEntry: { fontSize: 11, fontFamily: typography.fontRegular },
})
