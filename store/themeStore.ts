import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

type ThemeMode = 'light' | 'dark' | 'darker'

interface ThemeState {
  mode: ThemeMode
  isDarker: boolean
  hydrated: boolean
  setMode: (mode: ThemeMode) => void
  toggleTheme: () => void
  hydrate: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  isDarker: false,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    const stored = await AsyncStorage.getItem('themeMode').catch(() => null)
    // Support legacy 'isDark' key — if present, both modes are dark variants
    const legacyDark = await AsyncStorage.getItem('isDark').catch(() => null)
    let mode: ThemeMode = 'light'
    if (stored === 'light') mode = 'light'
    else if (stored === 'darker') mode = 'darker'
    else if (stored === 'dark') mode = 'dark'
    else if (legacyDark !== null) mode = 'dark' // migrate old users to dark
    set({ mode, isDarker: mode === 'darker', hydrated: true })
  },

  setMode: (mode: ThemeMode) => {
    AsyncStorage.setItem('themeMode', mode).catch(() => {})
    set({ mode, isDarker: mode === 'darker' })
  },

  toggleTheme: () => {
    const current = get().mode
    let next: ThemeMode = 'dark'
    if (current === 'light') next = 'dark'
    else if (current === 'dark') next = 'darker'
    else if (current === 'darker') next = 'light'
    AsyncStorage.setItem('themeMode', next).catch(() => {})
    set({ mode: next, isDarker: next === 'darker' })
  },
}))
