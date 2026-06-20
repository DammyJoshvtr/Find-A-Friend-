import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, withRepeat, withSequence,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { pickQuestions, getQuestionsByIndices, type TriviaQuestion } from '../../lib/triviaQuestions'
// import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { recordGameResult } from '../../lib/games'
import { client, broadcastEvent, subscribeToChannel } from '../../lib/aws'
import { getCurrentUser } from 'aws-amplify/auth'

const TIMER_SECS = 10
const TOTAL_QUESTIONS = 10
const BOT_NAME = 'FAF Bot 🤖'

type Phase = 'countdown' | 'playing' | 'result' | 'done'

export default function TriviaScreen() {
  const theme = useTheme()
  const { opponentName, opponentId, sessionId } = useLocalSearchParams<{ opponentName?: string, opponentId?: string, sessionId?: string }>()
  const botName = opponentName ?? BOT_NAME
  const user = useAuthStore(s => s.user)
  const myId = user?.id ?? ''

  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('countdown')
  const [countdown, setCountdown] = useState(3)
  const [timer, setTimer] = useState(TIMER_SECS)
  const [myScore, setMyScore] = useState(0)
  const [oppScore, setOppScore] = useState(0) // renamed from botScore
  const [myAnswer, setMyAnswer] = useState<number | null>(null)
  const [oppAnswer, setOppAnswer] = useState<number | null>(null) // renamed from botAnswer
  const [loading, setLoading] = useState(!!sessionId)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const botRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<any>(null)
  // Track current question index in a ref so the realtime handler always sees
  // the latest value without requiring a re-subscribe on each question.
  const qIndexRef = useRef(0)

  // Animations
  const timerScale = useSharedValue(1)
  const cardOpacity = useSharedValue(0)
  const cardTranslateY = useSharedValue(30)
  const scorePulse = useSharedValue(1)

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }))

  const timerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timerScale.value }],
  }))

  // Initial load
  useEffect(() => {
    if (sessionId) {
      loadSession()
      subscribe()
    } else {
      setQuestions(pickQuestions(TOTAL_QUESTIONS))
      setLoading(false)
    }
    return () => { channelRef.current && channelRef.current.unsubscribe() }
  }, [sessionId])

  const loadSession = async () => {
    const { data: sess } = await client.models.LiveGameSession.get({ id: sessionId })
    
    if (sess?.state?.q_indices) {
      setQuestions(getQuestionsByIndices(sess.state.q_indices))
    } else {
      setQuestions(pickQuestions(TOTAL_QUESTIONS))
    }
    setLoading(false)
  }

  const subscribe = () => {
    channelRef.current = subscribeToChannel(`game_room:${sessionId}`, (event, payload) => {
      if (event === 'move') {
        // Use qIndexRef (not the closed-over qIndex) so we always compare
        // against the current question, not the question at subscribe time.
        if (payload.type === 'ANSWER' && payload.qIndex === qIndexRef.current) {
          setOppAnswer(payload.answerIndex)
          setOppScore(payload.totalScore ?? 0)
        }
      }
    })
  }

  // Keep qIndexRef in sync with state so the broadcast handler sees current question
  useEffect(() => { qIndexRef.current = qIndex }, [qIndex])

  // Countdown before game
  useEffect(() => {
    if (phase !== 'countdown' || loading) return
    if (countdown <= 0) { startQuestion(); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, phase, loading])

  const startQuestion = () => {
    setPhase('playing')
    setMyAnswer(null)
    setOppAnswer(null)
    setTimer(TIMER_SECS)
    // Animate card in
    cardOpacity.value = withTiming(1, { duration: 300 })
    cardTranslateY.value = withSpring(0, { damping: 15 })
    
    if (!sessionId) scheduleBotAnswer()
  }

  const scheduleBotAnswer = () => {
    // Bot answers randomly between 2–8s (right 65% of the time)
    const delay = 2000 + Math.random() * 6000
    botRef.current = setTimeout(() => {
      const q = questions[qIndex]
      const correct = Math.random() < 0.65
      const ans = correct ? q.answer : (q.answer + 1 + Math.floor(Math.random() * 3)) % 4
      setOppAnswer(ans)
    }, delay)
  }

  // Main timer
  useEffect(() => {
    if (phase !== 'playing') return
    if (timer <= 0) { resolveRound(null, 0); return }
    timerRef.current = setInterval(() => setTimer(t => t - 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, qIndex])

  useEffect(() => {
    if (phase === 'playing' && timer <= 0) resolveRound(null, 0)
  }, [timer])

  const handleAnswer = (idx: number) => {
    if (myAnswer !== null || phase !== 'playing') return
    setMyAnswer(idx)
    if (timerRef.current) clearInterval(timerRef.current)

    // Calculate gain
    const q = questions[qIndex]
    let myGain = 0
    if (idx === q.answer) {
      myGain = 1 + Math.round((timer / TIMER_SECS) * 3)
    }
    const newScore = myScore + myGain

    // Broadcast if multiplayer
    if (channelRef.current) {
      broadcastEvent('game_room:' + sessionId, 'move', { type: 'ANSWER', qIndex, answerIndex: idx, totalScore: newScore })
    }

    // Small delay to show bot answer if not yet chosen
    setTimeout(() => resolveRound(idx, myGain), 1200)
  }

  const resolveRound = (chosen: number | null, myGain: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (botRef.current) clearTimeout(botRef.current)
    setPhase('result')

    const q = questions[qIndex]
    
    // If bot/opponent answered, calculate their gain
    setOppAnswer(prev => {
      const oppAns = prev
      if (!sessionId && oppAns === q.answer) {
        const botGain = 1 + Math.round(Math.random() * 2)
        setOppScore(s => s + botGain)
      }
      return oppAns
    })

    setMyScore(s => s + myGain)

    // Next question after 1.5s
    setTimeout(async () => {
      const next = qIndex + 1
      if (next >= TOTAL_QUESTIONS) {
        setPhase('done')
        // Record result only for real multiplayer games (not bot games)
        if (sessionId && opponentId && opponentId !== 'faf-bot' && myId) {
          const finalMyScore = myScore + myGain
          const winnerId = finalMyScore > oppScore ? myId : opponentId
          await recordGameResult('trivia', opponentId, winnerId, { me: finalMyScore, opp: oppScore })
          // Mark session as finished
          await client.models.LiveGameSession.update({ id: sessionId, status: 'finished', winner_id: winnerId })
        }
      } else {
        setQIndex(next)
        cardOpacity.value = 0
        cardTranslateY.value = 30
        startQuestion()
      }
    }, 1500)
  }

  const currentQ = questions[qIndex]
  const progress = qIndex / TOTAL_QUESTIONS

  if (phase === 'countdown') {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.countdownWrap}>
          <Text style={[s.countdownLabel, { color: theme.textMuted }]}>Game starts in</Text>
          <Text style={[s.countdownNum, { color: theme.accent }]}>{countdown || 'GO!'}</Text>
          <Text style={[s.vsText, { color: theme.textFaint }]}>You vs {botName}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (phase === 'done') {
    const won = myScore > oppScore
    const tied = myScore === oppScore
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.doneWrap}>
          <Text style={s.doneEmoji}>{won ? '🏆' : tied ? '🤝' : '😤'}</Text>
          <Text style={[s.doneTitle, { color: theme.text }]}>
            {won ? 'You Won!' : tied ? 'It\'s a Tie!' : `${botName} Wins!`}
          </Text>
          <View style={s.finalScoreRow}>
            <View style={s.finalScoreCard}>
              <Text style={[s.finalScoreName, { color: theme.textMuted }]}>You</Text>
              <Text style={[s.finalScoreNum, { color: theme.accent }]}>{myScore}</Text>
            </View>
            <Text style={[s.finalVs, { color: theme.textFaint }]}>vs</Text>
            <View style={s.finalScoreCard}>
              <Text style={[s.finalScoreName, { color: theme.textMuted }]}>{botName}</Text>
              <Text style={[s.finalScoreNum, { color: '#f87171' }]}>{oppScore}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: theme.accent }]}
            onPress={() => router.back()}>
            <Text style={s.doneBtnText}>Back to Lobby</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.doneBtn2, { borderColor: theme.border }]}
            onPress={() => router.replace('/play/trivia' as any)}>
            <Text style={[s.doneBtnText2, { color: theme.accent }]}>Play Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const timerPct = timer / TIMER_SECS
  const timerColor = timerPct > 0.5 ? '#34d399' : timerPct > 0.25 ? '#fbbf24' : '#f87171'

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      {/* Scoreboard */}
      <View style={[s.scoreboard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={s.scoreItem}>
          <Text style={[s.scoreName, { color: theme.textMuted }]}>You</Text>
          <Text style={[s.scoreNum, { color: theme.accent }]}>{myScore}</Text>
        </View>
        <View style={s.scoreCenter}>
          <Text style={[s.qCounter, { color: theme.textFaint }]}>{qIndex + 1}/{TOTAL_QUESTIONS}</Text>
          {/* Progress bar */}
          <View style={[s.progressBg, { backgroundColor: theme.card2 }]}>
            <View style={[s.progressFill, { width: `${progress * 100}%` as any, backgroundColor: theme.accent }]} />
          </View>
        </View>
        <View style={s.scoreItem}>
          <Text style={[s.scoreName, { color: theme.textMuted }]}>{botName}</Text>
          <Text style={[s.scoreNum, { color: '#f87171' }]}>{oppScore}</Text>
        </View>
      </View>

      {/* Timer */}
      <Animated.View style={[s.timerWrap, timerStyle]}>
        <View style={[s.timerCircle, { borderColor: timerColor }]}>
          <Text style={[s.timerText, { color: timerColor }]}>{timer}</Text>
        </View>
      </Animated.View>

      {/* Question card */}
      <Animated.View style={[s.qCard, { backgroundColor: theme.card, borderColor: theme.border }, cardStyle]}>
        <Text style={[s.qText, { color: theme.text }]}>{currentQ.q}</Text>

        {/* Opponent status */}
        <Text style={[s.botStatus, { color: theme.textFaint }]}>
          {oppAnswer !== null ? `${botName} answered ✓` : `${botName} is thinking…`}
        </Text>
      </Animated.View>

      {/* Options */}
      <View style={s.optionsWrap}>
        {currentQ.options.map((opt, i) => {
          const isMyPick = myAnswer === i
          const isCorrect = phase === 'result' && i === currentQ.answer
          const isWrong = phase === 'result' && isMyPick && i !== currentQ.answer

          let bg = theme.card
          let border = theme.border
          let textColor = theme.text

          if (isCorrect) { bg = 'rgba(52,211,153,0.15)'; border = '#34d399'; textColor = '#34d399' }
          else if (isWrong) { bg = 'rgba(248,113,113,0.15)'; border = '#f87171'; textColor = '#f87171' }
          else if (isMyPick) { bg = 'rgba(167,139,250,0.15)'; border = theme.accent; textColor = theme.accent }

          return (
            <TouchableOpacity
              key={i}
              style={[s.option, { backgroundColor: bg, borderColor: border }]}
              onPress={() => handleAnswer(i)}
              disabled={myAnswer !== null || phase !== 'playing'}
              activeOpacity={0.75}>
              <View style={[s.optLetter, { backgroundColor: border + '33' }]}>
                <Text style={[s.optLetterText, { color: border !== theme.border ? border : theme.textMuted }]}>
                  {['A', 'B', 'C', 'D'][i]}
                </Text>
              </View>
              <Text style={[s.optText, { color: textColor }]}>{opt}</Text>
              {isCorrect && <Ionicons name="checkmark-circle" size={18} color="#34d399" />}
              {isWrong && <Ionicons name="close-circle" size={18} color="#f87171" />}
            </TouchableOpacity>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },

  countdownWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  countdownLabel: { fontSize: 16, fontFamily: typography.fontRegular },
  countdownNum: { fontSize: 80, fontFamily: typography.fontBold },
  vsText: { fontSize: 14, fontFamily: typography.fontRegular },

  scoreboard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, padding: 14, marginTop: 12, marginBottom: 8,
    borderWidth: 0.5,
  },
  scoreItem: { flex: 1, alignItems: 'center', gap: 2 },
  scoreName: { fontSize: 11, fontFamily: typography.fontMedium },
  scoreNum: { fontSize: 24, fontFamily: typography.fontBold },
  scoreCenter: { flex: 1, alignItems: 'center', gap: 6 },
  qCounter: { fontSize: 11, fontFamily: typography.fontRegular },
  progressBg: { height: 4, borderRadius: 2, width: '100%' },
  progressFill: { height: 4, borderRadius: 2 },

  timerWrap: { alignItems: 'center', marginVertical: 8 },
  timerCircle: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
  },
  timerText: { fontSize: 20, fontFamily: typography.fontBold },

  qCard: {
    borderRadius: 20, padding: 20, marginBottom: 14,
    borderWidth: 0.5, gap: 12,
  },
  qText: { fontSize: 16, fontFamily: typography.fontSemiBold, lineHeight: 24 },
  botStatus: { fontSize: 11, fontFamily: typography.fontRegular },

  optionsWrap: { gap: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 14, borderWidth: 1,
  },
  optLetter: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  optLetterText: { fontSize: 13, fontFamily: typography.fontBold },
  optText: { flex: 1, fontSize: 14, fontFamily: typography.fontMedium },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  doneEmoji: { fontSize: 72 },
  doneTitle: { fontSize: 28, fontFamily: typography.fontBold },
  finalScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 24, marginVertical: 8 },
  finalScoreCard: { alignItems: 'center', gap: 4 },
  finalScoreName: { fontSize: 12, fontFamily: typography.fontMedium },
  finalScoreNum: { fontSize: 40, fontFamily: typography.fontBold },
  finalVs: { fontSize: 16, fontFamily: typography.fontRegular },
  doneBtn: {
    borderRadius: 20, paddingHorizontal: 36, paddingVertical: 14,
    width: '80%', alignItems: 'center',
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  doneBtnText: { fontSize: 15, fontFamily: typography.fontBold, color: '#fff' },
  doneBtn2: { borderRadius: 20, paddingHorizontal: 36, paddingVertical: 14, width: '80%', alignItems: 'center', borderWidth: 1 },
  doneBtnText2: { fontSize: 15, fontFamily: typography.fontSemiBold },
})
