import {
  View, Text, StyleSheet, TouchableOpacity, useWindowDimensions,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withSequence, withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect, useRef } from 'react'
// import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { recordGameResult } from '../../lib/games'
import { client, broadcastEvent, subscribeToChannel } from '../../lib/aws'
import { getCurrentUser } from 'aws-amplify/auth'

const WORDS = [
  'FLAME','BLAZE','SPARK','GRIND','SCORE','PHASE','FOCUS','BRAVE','CODED','DRAFT',
  'ELITE','FRESH','GLARE','HASTE','INTEL','JUDGE','KNEEL','LOGIC','MIXER','NIGHT',
  'ORBIT','PLACE','QUEST','RADAR','STEAM','TRAIN','UNITY','VOICE','WATCH','YIELD',
  'MAGIC','POWER','LIGHT','SMOKE','STORM','FROST','BLOOM','CRANE','DRIVE','EPOCH',
  'FAULT','GLIDE','HEIST','IVORY','JOKER','KNACK','LANCE','MEDIC','NOISE','OZONE',
]

const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
]

const MAX_GUESSES = 6
const BOT_NAME = 'FAF Bot 🤖'

type LetterState = 'correct' | 'present' | 'absent' | 'empty' | 'active'

function getLetterStates(guess: string, word: string): LetterState[] {
  const result: LetterState[] = Array(5).fill('absent')
  const wordArr = word.split('')
  const used = Array(5).fill(false)
  // First pass: correct
  for (let i = 0; i < 5; i++) {
    if (guess[i] === word[i]) { result[i] = 'correct'; used[i] = true }
  }
  // Second pass: present
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue
    const idx = wordArr.findIndex((l, j) => l === guess[i] && !used[j])
    if (idx !== -1) { result[i] = 'present'; used[idx] = true }
  }
  return result
}

function cellBg(state: LetterState, theme: any): string {
  if (state === 'correct') return '#34d399'
  if (state === 'present') return '#fbbf24'
  if (state === 'absent')  return theme.card2
  if (state === 'active')  return theme.card
  return theme.card
}

function cellBorder(state: LetterState, theme: any): string {
  if (state === 'correct') return '#34d399'
  if (state === 'present') return '#fbbf24'
  if (state === 'absent')  return theme.border
  if (state === 'active')  return theme.accent
  return theme.border
}

function keyBg(letter: string, keyStates: Record<string, LetterState>, theme: any): string {
  const s = keyStates[letter]
  if (s === 'correct') return '#34d399'
  if (s === 'present') return '#fbbf24'
  if (s === 'absent')  return theme.card2
  return theme.card
}

// Simple bot: picks random valid words
function botNextGuess(word: string, attempt: number): string {
  // Bot has a chance to guess correctly on higher attempts
  const correctChance = attempt * 0.15
  if (Math.random() < correctChance) return word
  return WORDS[Math.floor(Math.random() * WORDS.length)]
}

export default function WordleScreen() {
  const theme = useTheme()
  const { width: screenWidth } = useWindowDimensions()
  // Each grid column gets half the screen minus padding (16) minus divider (2) minus gap (8)
  const CELL = Math.max(26, Math.floor((screenWidth - 26) / 2 / 5) - 4)
  const { opponentName, opponentId, sessionId } = useLocalSearchParams<{ opponentName?: string, opponentId?: string, sessionId?: string }>()
  const botName = opponentName ?? BOT_NAME
  const user = useAuthStore(s => s.user)

  const [word, setWord] = useState('')
  const [guesses, setGuesses] = useState<string[]>([])
  const [current, setCurrent] = useState('')
  const [keyStates, setKeyStates] = useState<Record<string, LetterState>>({})
  const [botGuesses, setBotGuesses] = useState<string[]>([]) // Still named botGuesses for compatibility
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState<'me' | 'bot' | 'none' | null>(null)
  const [loading, setLoading] = useState(!!sessionId)

  const channelRef = useRef<any>(null)
  // Ref-synced word so the broadcast handler is never stale
  const wordRef = useRef('')

  const shakeValue = useSharedValue(0)
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeValue.value }] }))

  // Keep wordRef in sync with state
  useEffect(() => { wordRef.current = word }, [word])

  // Initial load
  useEffect(() => {
    if (sessionId) {
      loadSession()
      subscribe()
    } else {
      setWord(WORDS[Math.floor(Math.random() * WORDS.length)])
      setLoading(false)
    }
    return () => { channelRef.current && channelRef.current.unsubscribe() }
  }, [sessionId])

  const loadSession = async () => {
    try {
      const { data: sess } = await client.models.LiveGameSession.get({ id: sessionId })

      if (sess?.state?.word) {
        setWord(sess.state.word)
      } else {
        setWord(WORDS[Math.floor(Math.random() * WORDS.length)])
      }
    } catch {
      // Non-fatal — fall back to random word
      setWord(WORDS[Math.floor(Math.random() * WORDS.length)])
    } finally {
      setLoading(false)
    }
  }

  const subscribe = () => {
    channelRef.current = subscribeToChannel(`game_room:${sessionId}`, (event, payload) => {
      if (event === 'move') {
        if (payload.type === 'GUESS') {
          setBotGuesses(prev => {
            const next = [...prev, payload.word]
            // Use ref to avoid stale closure on word state
            if (payload.word === wordRef.current) {
              setGameOver(true)
              setWinner('bot')
              // Record result for real multiplayer — opponent won
              if (opponentId && opponentId !== 'faf-bot' && user?.id) {
                recordGameResult('wordle', opponentId, opponentId, { me_guesses: 0, opp_guesses: next.length }).catch(() => {})
                client.models.LiveGameSession.update({ id: sessionId, status: 'finished', winner_id: opponentId }).then(() => {})
              }
            } else if (next.length >= MAX_GUESSES) {
              // Both must fail to be none
            }
            return next
          })
        }
      }
    })
  }

  // Bot guesses on a timer (only if no session)
  useEffect(() => {
    if (sessionId || gameOver || botGuesses.length >= MAX_GUESSES) return
    if (botGuesses.some(g => g === word)) return
    const delay = 4000 + Math.random() * 5000
    const t = setTimeout(() => {
      const guess = botNextGuess(word, botGuesses.length)
      setBotGuesses(prev => {
        const next = [...prev, guess]
        if (guess === word) {
          if (!guesses.some(g => g === word)) {
            setGameOver(true)
            setWinner('bot')
          }
        }
        return next
      })
    }, delay)
    return () => clearTimeout(t)
  }, [botGuesses, gameOver, sessionId, word])

  const submitGuess = () => {
    if (current.length < 5 || gameOver) return
    if (!WORDS.includes(current) && !WORDS.map(w => w).includes(current)) {
      // Allow any 5-letter guess for playability
    }

    const newGuesses = [...guesses, current]
    setGuesses(newGuesses)

    // Broadcast if multiplayer
    if (channelRef.current) {
      broadcastEvent('game_room:' + sessionId, 'move', { type: 'GUESS', word: current })
    }

    // Update key states
    const states = getLetterStates(current, word)
    setKeyStates(prev => {
      const next = { ...prev }
      current.split('').forEach((l, i) => {
        const s = states[i]
        if (s === 'correct') next[l] = 'correct'
        else if (s === 'present' && next[l] !== 'correct') next[l] = 'present'
        else if (!next[l]) next[l] = 'absent'
      })
      return next
    })

    if (current === word) {
      setGameOver(true)
      setWinner('me')
      // Record result for real multiplayer games
      if (sessionId && opponentId && opponentId !== 'faf-bot' && user?.id) {
        recordGameResult('wordle', opponentId, user.id, { me_guesses: newGuesses.length, opp_guesses: botGuesses.length }).catch(() => {})
        client.models.LiveGameSession.update({ id: sessionId, status: 'finished', winner_id: user.id }).then(() => {})
      }
    } else if (newGuesses.length >= MAX_GUESSES) {
      // If opponent still has guesses, don't end game yet
      if (!sessionId || botGuesses.length >= MAX_GUESSES) {
        setGameOver(true)
        setWinner('none')
        // Record result for real multiplayer — nobody won
        if (sessionId && opponentId && opponentId !== 'faf-bot' && user?.id) {
          recordGameResult('wordle', opponentId, opponentId, { me_guesses: newGuesses.length, opp_guesses: botGuesses.length }).catch(() => {})
          client.models.LiveGameSession.update({ id: sessionId, status: 'finished', winner_id: null }).then(() => {})
        }
      }
    }

    setCurrent('')
  }

  const handleKey = (key: string) => {
    if (gameOver) return
    if (key === '⌫') { setCurrent(c => c.slice(0, -1)); return }
    if (key === 'ENTER') { submitGuess(); return }
    if (current.length < 5) setCurrent(c => c + key)
  }

  const renderGrid = (guessList: string[], isMine: boolean) => {
    const rows: React.ReactNode[] = []
    for (let r = 0; r < MAX_GUESSES; r++) {
      const guess = guessList[r] ?? ''
      const isCurrentRow = isMine && r === guessList.length && !gameOver
      const states: LetterState[] = guess
        ? getLetterStates(guess, word)
        : Array(5).fill(isCurrentRow ? 'active' : 'empty')

      const displayStr = isCurrentRow ? current : guess

      rows.push(
        <View key={r} style={s.gridRow}>
          {Array(5).fill(0).map((_, c) => {
            const letter = displayStr[c] ?? ''
            const state: LetterState = guess ? states[c] : (letter ? 'active' : (isCurrentRow ? 'active' : 'empty'))
            return (
              <View
                key={c}
                style={[
                  s.cell,
                  {
                    width: CELL, height: CELL,
                    backgroundColor: cellBg(guess ? states[c] : (letter ? 'active' : 'empty'), theme),
                    borderColor: cellBorder(guess ? states[c] : (letter ? 'active' : 'empty'), theme),
                  },
                ]}>
                <Text style={[s.cellText, {
                  color: (guess && states[c] !== 'absent') ? '#fff' : theme.text,
                }]}>{letter}</Text>
              </View>
            )
          })}
        </View>
      )
    }
    return rows
  }

  if (gameOver) {
    const won = winner === 'me'
    const tied = winner === 'none'
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.doneWrap}>
          <Text style={s.doneEmoji}>{won ? '🏆' : tied ? '💀' : '🤖'}</Text>
          <Text style={[s.doneTitle, { color: theme.text }]}>
            {won ? 'You got it!' : tied ? 'No one got it!' : `${botName} won!`}
          </Text>
          <View style={[s.revealWord, { backgroundColor: theme.card, borderColor: theme.accent }]}>
            <Text style={[s.revealLabel, { color: theme.textMuted }]}>The word was</Text>
            <Text style={[s.revealWordText, { color: theme.accent }]}>{word}</Text>
          </View>
          <View style={s.doneStats}>
            <Text style={[s.doneStat, { color: theme.textMuted }]}>
              You: {guesses.length} guess{guesses.length !== 1 ? 'es' : ''}
            </Text>
            <Text style={[s.doneStat, { color: theme.textMuted }]}>
              {botName}: {botGuesses.length} guess{botGuesses.length !== 1 ? 'es' : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: theme.accent }]}
            onPress={() => router.back()}>
            <Text style={s.doneBtnText}>Back to Lobby</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.doneBtn2, { borderColor: theme.border }]}
            onPress={() => router.replace('/play/wordle' as any)}>
            <Text style={[s.doneBtnText2, { color: theme.accent }]}>Play Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { borderColor: theme.border }]}>
          <Text style={[s.backText, { color: theme.text }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Word Duel 📝</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Grids side by side */}
      <View style={s.gridsRow}>
        <View style={s.gridCol}>
          <Text style={[s.gridLabel, { color: theme.accent }]}>You</Text>
          <Animated.View style={shakeStyle}>
            {renderGrid(guesses, true)}
          </Animated.View>
        </View>
        <View style={[s.gridDivider, { backgroundColor: theme.border }]} />
        <View style={s.gridCol}>
          <Text style={[s.gridLabel, { color: '#f87171' }]}>{botName}</Text>
          {renderGrid(botGuesses, false)}
        </View>
      </View>

      {/* Keyboard */}
      <View style={s.keyboard}>
        {KEYBOARD_ROWS.map((row, ri) => (
          <View key={ri} style={s.keyRow}>
            {row.map(key => (
              <TouchableOpacity
                key={key}
                style={[
                  s.key,
                  key === 'ENTER' || key === '⌫' ? s.keyWide : null,
                  { backgroundColor: keyBg(key, keyStates, theme), borderColor: theme.border },
                ]}
                onPress={() => handleKey(key)}
                activeOpacity={0.7}>
                <Text style={[s.keyText, { color: keyStates[key] && keyStates[key] !== 'absent' ? '#fff' : theme.text }]}>
                  {key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 14 },
  title: { fontSize: 16, fontFamily: typography.fontBold },

  gridsRow: { flexDirection: 'row', flex: 1, paddingHorizontal: 4 },
  gridCol: { flex: 1, alignItems: 'center', gap: 2, paddingTop: 6 },
  gridLabel: { fontSize: 11, fontFamily: typography.fontSemiBold, marginBottom: 4 },
  gridDivider: { width: StyleSheet.hairlineWidth, marginVertical: 8, marginHorizontal: 2 },
  gridRow: { flexDirection: 'row', gap: 2, marginBottom: 2 },
  cell: {
    borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  cellText: { fontSize: 13, fontFamily: typography.fontBold },

  keyboard: { paddingHorizontal: 4, paddingBottom: 12, gap: 4 },
  keyRow: { flexDirection: 'row', justifyContent: 'center', gap: 3 },
  key: {
    minWidth: 26, height: 38, borderRadius: 7, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  keyWide: { minWidth: 44 },
  keyText: { fontSize: 10, fontFamily: typography.fontSemiBold },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  doneEmoji: { fontSize: 64 },
  doneTitle: { fontSize: 26, fontFamily: typography.fontBold },
  revealWord: { borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, width: '80%', gap: 4 },
  revealLabel: { fontSize: 12, fontFamily: typography.fontRegular },
  revealWordText: { fontSize: 28, fontFamily: typography.fontBold, letterSpacing: 8 },
  doneStats: { gap: 4 },
  doneStat: { fontSize: 13, fontFamily: typography.fontRegular, textAlign: 'center' },
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
