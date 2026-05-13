import { supabase } from './supabase'

export type GameType = 'pool' | 'trivia' | 'wordle'

export interface LeaderboardEntry {
  user_id: string
  full_name: string | null
  avatar_url: string | null
  wins: number
  games_played: number
  win_rate: number
}

export interface UserGameStats {
  game_type: GameType
  wins: number
  losses: number
  games_played: number
}

export interface GameSession {
  id: string
  game_type: GameType
  player1_id: string
  player2_id: string
  winner_id: string | null
  score: Record<string, unknown>
  duration_seconds: number | null
  created_at: string
  finished_at: string | null
}

// ─── Game metadata ────────────────────────────────────────────────────────────

export const GAME_META: Record<GameType, {
  label: string
  emoji: string
  tagline: string
  color: string
  bg: string
  border: string
  rules: string[]
}> = {
  pool: {
    label: '8-Ball Pool',
    emoji: '🎱',
    tagline: 'Classic 2-player billiards',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.3)',
    rules: [
      'One player gets solids (1–7), the other stripes (9–15)',
      'Pocket all your balls, then sink the 8-ball to win',
      'Scratch on the 8-ball is an instant loss',
      'Call your shots — no slop on the 8',
    ],
  },
  trivia: {
    label: 'Trivia Battle',
    emoji: '🧠',
    tagline: '10 questions · fastest answer wins',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.12)',
    border: 'rgba(96,165,250,0.3)',
    rules: [
      '10 multiple-choice questions per round',
      'You have 10 seconds to answer each question',
      'Faster correct answers score more points',
      'Highest total score at the end wins',
    ],
  },
  wordle: {
    label: 'Word Duel',
    emoji: '📝',
    tagline: 'Guess the word in 6 tries',
    color: '#f472b6',
    bg: 'rgba(244,114,182,0.12)',
    border: 'rgba(244,114,182,0.3)',
    rules: [
      'Both players get the same hidden 5-letter word',
      'You have 6 tries to guess it',
      'Green = right letter, right place · Yellow = right letter, wrong place',
      'Fewest guesses wins — ties go to faster completion time',
    ],
  },
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getLeaderboard(
  gameType: GameType,
  limit = 20
): Promise<{ data: LeaderboardEntry[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('winner_id, player1_id, player2_id')
      .eq('game_type', gameType)

    if (error) throw error

    const winMap = new Map<string, number>()
    const playedMap = new Map<string, number>()

    for (const row of (data ?? [])) {
      if (row.winner_id) {
        winMap.set(row.winner_id, (winMap.get(row.winner_id) ?? 0) + 1)
      }
      playedMap.set(row.player1_id, (playedMap.get(row.player1_id) ?? 0) + 1)
      playedMap.set(row.player2_id, (playedMap.get(row.player2_id) ?? 0) + 1)
    }

    const ranked = Array.from(winMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)

    if (ranked.length === 0) return { data: [], error: null }

    const ids = ranked.map(([id]) => id)
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', ids)

    if (profErr) throw profErr

    const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    const entries: LeaderboardEntry[] = ranked.map(([userId, wins]) => {
      const p = profMap.get(userId) as any
      const played = playedMap.get(userId) ?? wins
      return {
        user_id: userId,
        full_name: p?.full_name ?? 'Player',
        avatar_url: p?.avatar_url ?? null,
        wins,
        games_played: played,
        win_rate: Math.round((wins / played) * 100),
      }
    })

    return { data: entries, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ─── Current user stats ───────────────────────────────────────────────────────

export async function getMyStats(): Promise<{
  data: UserGameStats[] | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('game_sessions')
      .select('game_type, winner_id')
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)

    if (error) throw error

    const map = new Map<string, { wins: number; played: number }>()
    for (const row of (data ?? [])) {
      const cur = map.get(row.game_type) ?? { wins: 0, played: 0 }
      cur.played++
      if (row.winner_id === user.id) cur.wins++
      map.set(row.game_type, cur)
    }

    const stats: UserGameStats[] = Array.from(map.entries()).map(([type, s]) => ({
      game_type: type as GameType,
      wins: s.wins,
      losses: s.played - s.wins,
      games_played: s.played,
    }))

    return { data: stats, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getMyRank(gameType: GameType): Promise<{
  data: number | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: null }

    const { data } = await getLeaderboard(gameType, 200)
    if (!data) return { data: null, error: null }

    const idx = data.findIndex(e => e.user_id === user.id)
    return { data: idx === -1 ? null : idx + 1, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ─── Record result ────────────────────────────────────────────────────────────

export async function recordGameResult(
  gameType: GameType,
  opponentId: string,
  winnerId: string,
  score?: Record<string, unknown>,
  durationSeconds?: number
): Promise<{ error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('game_sessions')
      .insert({
        game_type: gameType,
        player1_id: user.id,
        player2_id: opponentId,
        winner_id: winnerId,
        score: score ?? {},
        duration_seconds: durationSeconds ?? null,
        finished_at: new Date().toISOString(),
      })

    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err as Error }
  }
}
