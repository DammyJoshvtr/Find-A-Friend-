import React, { createContext, useContext } from 'react'
import { useThemeStore } from '../store/themeStore'

export const DARK = {
  bg:         '#0d0d14',
  card:       '#1c1c2e',
  card2:      '#24243a',
  text:       '#f0f0ff',
  textMuted:  'rgba(240,240,255,0.45)',
  textFaint:  'rgba(240,240,255,0.25)',
  border:     'rgba(255,255,255,0.08)',
  border2:    'rgba(255,255,255,0.05)',
  accent:     '#a78bfa',
  accentBg:   'rgba(167,139,250,0.15)',
  accentBorder:'rgba(167,139,250,0.35)',
  danger:     '#ef4444',
  success:    '#34d399',
  statusBar:  'light' as const,
}

export const LIGHT = {
  bg:         '#f2f2f7',
  card:       '#ffffff',
  card2:      '#e8e8f0',
  text:       '#0d0d20',
  textMuted:  'rgba(13,13,32,0.5)',
  textFaint:  'rgba(13,13,32,0.3)',
  border:     'rgba(0,0,0,0.08)',
  border2:    'rgba(0,0,0,0.04)',
  accent:     '#7c3aed',
  accentBg:   'rgba(124,58,237,0.1)',
  accentBorder:'rgba(124,58,237,0.3)',
  danger:     '#dc2626',
  success:    '#059669',
  statusBar:  'dark' as const,
}

export type ThemeColors = {
  bg: string
  card: string
  card2: string
  text: string
  textMuted: string
  textFaint: string
  border: string
  border2: string
  accent: string
  accentBg: string
  accentBorder: string
  danger: string
  success: string
  statusBar: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeColors>(DARK)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDark } = useThemeStore()
  return React.createElement(ThemeContext.Provider, { value: isDark ? DARK : LIGHT }, children)
}

export function useTheme(): ThemeColors {
  return useContext(ThemeContext)
}
