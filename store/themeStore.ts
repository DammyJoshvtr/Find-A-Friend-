import { create } from 'zustand'
import { MMKV } from 'react-native-mmkv'

const storage = new MMKV()

interface ThemeState {
  isDark: boolean
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: storage.getBoolean('isDark') ?? true,

  toggleTheme: () =>
    set((state) => {
      const next = !state.isDark
      storage.set('isDark', next)
      return { isDark: next }
    }),
}))