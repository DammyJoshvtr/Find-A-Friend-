import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { client } from '../lib/aws'

interface BadgesState {
  lastSeen: {
    home: string
    discover: string
    events: string
    chat: string
    academic: string
    clubs_feature: string
    anonymous: string
    vendors: string
    games: string
  }
  counts: {
    home: number
    discover: number
    events: number
    chat: number
    academic: number
    clubs_feature: number
    anonymous: number
    vendors: number
    games: number
  }
  markSeen: (tab: 'home' | 'discover' | 'events' | 'chat' | 'academic' | 'clubs_feature' | 'anonymous' | 'vendors' | 'games') => void
  syncCounts: () => Promise<void>
}

// Fallback to exactly 1 day ago for a clean initial state
const getInitialTime = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

export const useBadgesStore = create<BadgesState>()(
  persist(
    (set, get) => ({
      lastSeen: {
        home: getInitialTime(),
        discover: getInitialTime(),
        events: getInitialTime(),
        chat: getInitialTime(),
        academic: getInitialTime(),
        clubs_feature: getInitialTime(),
        anonymous: getInitialTime(),
        vendors: getInitialTime(),
        games: getInitialTime(),
      },
      counts: {
        home: 0,
        discover: 0,
        events: 0,
        chat: 0,
        academic: 0,
        clubs_feature: 0,
        anonymous: 0,
        vendors: 0,
        games: 0,
      },
      markSeen: (tab) => {
        set((state) => ({
          lastSeen: {
            ...state.lastSeen,
            [tab]: new Date().toISOString(),
          },
          counts: {
            ...state.counts,
            [tab]: 0,
          },
        }))
      },
      syncCounts: async () => {
        try {
          // TODO: AWS Auth
          const { data: { user } } = await (client as any).auth.getUser()
          if (!user) return

          const { lastSeen } = get()
          
          // Count new posts
          const p1 = client.models.posts.list()

          // Count new clubs
          const p2 = client.models.clubs.list()

          // Count new events
          const p3 = client.models.events.list()

          // Count new chat messages not sent by us
          // Note: we can't easily filter by "my conversations" without a join or nested query in head:true, 
          // so we'll do a simple select.
          // First, get my conversation ids
          const { data: myConvs } = await client.models.conversation_participants.list()

          let chatCount = 0
          if (myConvs && myConvs.length > 0) {
            const convIds = myConvs.map(c => c.conversation_id)
            const count = (await client.models.messages.list()).data.length
            chatCount = count || 0
          }

          // Count feature badges
          const pAcademic = client.models.study_groups.list()
          const pClubs = client.models.clubs.list()
          const pAnon = client.models.anonymous_posts.list()
          const pVendors = client.models.vendors.list()
          const pGames = client.models.game_sessions.list()

          const [res1, res2, res3, rAcad, rClubs, rAnon, rVendors, rGames] = await Promise.all([
            p1, p2, p3, pAcademic, pClubs, pAnon, pVendors, pGames
          ])

          set((state) => ({
            counts: {
              ...state.counts,
              home: (res1 as any).count || 0,
              discover: (res2 as any).count || 0,
              events: (res3 as any).count || 0,
              chat: chatCount,
              academic: (rAcad as any).count || 0,
              clubs_feature: (rClubs as any).count || 0,
              anonymous: (rAnon as any).count || 0,
              vendors: (rVendors as any).count || 0,
              games: (rGames as any).count || 0,
            }
          }))

        } catch (error) {
          console.error("Failed to sync badge counts:", error)
        }
      }
    }),
    {
      name: 'faf-badges-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lastSeen: state.lastSeen }), // Only persist lastSeen
    }
  )
)
