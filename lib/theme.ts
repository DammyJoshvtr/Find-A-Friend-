import * as React from 'react'
import { createContext, useContext } from 'react'
import { useThemeStore } from '../store/themeStore'

export const glowShadow = {
  shadowColor: '#a78bfa',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 8,
} as const

// Dark mode — the standard deep dark theme
export const DARK = {
  bg:              '#0a0a1a',
  card:            'rgba(255,255,255,0.04)',
  cardSolid:       '#0f0f2a',
  card2:           '#24243a',
  text:            '#f0f0ff',
  textMuted:       'rgba(240,240,255,0.55)',
  textFaint:       'rgba(240,240,255,0.2)',
  border:          'rgba(255,255,255,0.08)',
  border2:         'rgba(255,255,255,0.05)',
  borderAccent:    'rgba(167,139,250,0.3)',
  accent:          '#a78bfa',
  accentSecondary: '#6366f1',
  accentBg:        'rgba(167,139,250,0.15)',
  accentBorder:    'rgba(167,139,250,0.35)',
  accentGlow:      'rgba(167,139,250,0.25)',
  cyan:            '#22d3ee',
  danger:          '#ef4444',
  success:         '#34d399',
  statusBar:       'light' as const,
}

// Darker mode — near-black "amoled" variant
export const DARKER = {
  bg:              '#050508',
  card:            'rgba(255,255,255,0.025)',
  cardSolid:       '#08080f',
  card2:           '#14141e',
  text:            '#f0f0ff',
  textMuted:       'rgba(240,240,255,0.5)',
  textFaint:       'rgba(240,240,255,0.18)',
  border:          'rgba(255,255,255,0.06)',
  border2:         'rgba(255,255,255,0.03)',
  borderAccent:    'rgba(167,139,250,0.25)',
  accent:          '#a78bfa',
  accentSecondary: '#6366f1',
  accentBg:        'rgba(167,139,250,0.12)',
  accentBorder:    'rgba(167,139,250,0.3)',
  accentGlow:      'rgba(167,139,250,0.2)',
  cyan:            '#22d3ee',
  danger:          '#ef4444',
  success:         '#34d399',
  statusBar:       'light' as const,
}

export type ThemeColors = {
  bg: string
  card: string
  cardSolid: string
  card2: string
  text: string
  textMuted: string
  textFaint: string
  border: string
  border2: string
  borderAccent: string
  accent: string
  accentSecondary: string
  accentBg: string
  accentBorder: string
  accentGlow: string
  cyan: string
  danger: string
  success: string
  statusBar: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeColors>(DARK)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDarker } = useThemeStore()
  return React.createElement(ThemeContext.Provider, { value: isDarker ? DARKER : DARK }, children)
}

export function useTheme(): ThemeColors {
  return useContext(ThemeContext)
}
