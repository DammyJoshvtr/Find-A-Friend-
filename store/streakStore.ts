import { create } from 'zustand'
import { client } from '../lib/aws'

interface StreakState {
  currentStreak: number
  longestStreak: number
  showCelebration: boolean
  hasLoaded: boolean
  recordDailyActivity: () => Promise<void>
  closeCelebration: () => void
}

export const useStreakStore = create<StreakState>((set, get) => ({
  currentStreak: 0,
  longestStreak: 0,
  showCelebration: false,
  hasLoaded: false,

  recordDailyActivity: async () => {
    try {
      // Use local date in YYYY-MM-DD format based on user's timezone
      const today = new Date()
      // Adjust for local timezone offset to get the correct local calendar date
      const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0]

      // TODO: Complex RPC
      const { data, error } = { data: null, error: null } as any;

      if (error) {
        console.error('Streak update error:', error)
        return
      }

      if (data) {
        const { current_streak, longest_streak, increased } = data as any
        set({
          currentStreak: current_streak,
          longestStreak: longest_streak,
          showCelebration: increased && current_streak > 1, // Only celebrate if > 1 and it just increased today
          hasLoaded: true,
        })
      }
    } catch (e) {
      console.error('Streak update exception:', e)
    }
  },

  closeCelebration: () => set({ showCelebration: false }),
}))
