import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface ThemeState {
  isDark: boolean
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: true,

  toggleTheme: () =>
    set((state) => {
      const next = !state.isDark
      AsyncStorage.setItem('isDark', String(next)).catch(() => {})
      return { isDark: next }
    }),
}))