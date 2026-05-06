import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface ThemeState {
  isDark: boolean
  hydrated: boolean
  toggleTheme: () => void
  hydrate: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: true,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    const stored = await AsyncStorage.getItem('isDark').catch(() => null)
    const isDark = stored === null ? true : stored === 'true'
    set({ isDark, hydrated: true })
  },

  toggleTheme: () =>
    set((state) => {
      const next = !state.isDark
      AsyncStorage.setItem('isDark', String(next)).catch(() => {})
      return { isDark: next }
    }),
}))
