import { create } from 'zustand'

interface PresenceState {
  onlineIds: Record<string, true>
  setOnlineUsers: (ids: string[]) => void
  isOnline: (userId: string) => boolean
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineIds: {},

  setOnlineUsers: (ids: string[]) => {
    const map: Record<string, true> = {}
    ids.forEach(id => { map[id] = true })
    set({ onlineIds: map })
  },

  isOnline: (userId: string) => Boolean(get().onlineIds[userId]),
}))
