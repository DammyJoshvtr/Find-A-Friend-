import * as React from "react";
import { createContext, useContext } from "react";
import { useThemeStore } from "../store/themeStore";

export const glowShadow = {
  shadowColor: "#a78bfa",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 8,
} as const;

// Light mode
export const LIGHT = {
  bg: "#f8fafc",
  card: "rgba(255,255,255,0.8)",
  cardSolid: "#ffffff",
  card2: "#f1f5f9",

  text: "#0f172a",
  textMuted: "#64748b",
  textFaint: "#94a3b8",

  border: "#e2e8f0",
  border2: "#f1f5f9",
  borderAccent: "rgba(139,92,246,0.3)",

  accent: "#8b5cf6",
  accentSecondary: "#6366f1",

  accentBg: "#f5f3ff",
  accentBorder: "#ddd6fe",
  accentGlow: "rgba(139,92,246,0.15)",

  cyan: "#06b6d4",
  danger: "#ef4444",
  success: "#10b981",

  statusBar: "dark" as const,
};

// Dark mode — the standard deep dark theme
export const DARK = {
  bg: "#0a0a1a",
  card: "rgba(255,255,255,0.04)",
  cardSolid: "#0f0f2a",
  card2: "#24243a",
  text: "#f0f0ff",
  textMuted: "rgba(240,240,255,0.55)",
  textFaint: "rgba(240,240,255,0.2)",
  border: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.05)",
  borderAccent: "rgba(167,139,250,0.3)",
  accent: "#a78bfa",
  accentSecondary: "#6366f1",
  accentBg: "rgba(167,139,250,0.15)",
  accentBorder: "rgba(167,139,250,0.35)",
  accentGlow: "rgba(167,139,250,0.25)",
  cyan: "#22d3ee",
  danger: "#ef4444",
  success: "#34d399",
  statusBar: "light" as const,
};

// Darker mode — near-black "amoled" variant
export const DARKER = {
  bg: "#050508",
  card: "rgba(255,255,255,0.025)",
  cardSolid: "#08080f",
  card2: "#14141e",
  text: "#f0f0ff",
  textMuted: "rgba(240,240,255,0.55)",
  textFaint: "rgba(240,240,255,0.2)",
  border: "rgba(255,255,255,0.06)",
  border2: "rgba(255,255,255,0.03)",
  borderAccent: "rgba(167,139,250,0.25)",
  accent: "#a78bfa",
  accentSecondary: "#6366f1",
  accentBg: "rgba(167,139,250,0.12)",
  accentBorder: "rgba(167,139,250,0.35)",
  accentGlow: "rgba(167,139,250,0.2)",
  cyan: "#22d3ee",
  danger: "#ef4444",
  success: "#34d399",
  statusBar: "light" as const,
};

export type ThemeColors = {
  bg: string;
  card: string;
  cardSolid: string;
  card2: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  border2: string;
  borderAccent: string;
  accent: string;
  accentSecondary: string;
  accentBg: string;
  accentBorder: string;
  accentGlow: string;
  cyan: string;
  danger: string;
  success: string;
  statusBar: "light" | "dark";
};

const ThemeContext = createContext<ThemeColors>(DARK);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeStore();
  const theme = mode === 'light' ? LIGHT : (mode === 'darker' ? DARKER : DARK);
  return React.createElement(
    ThemeContext.Provider,
    { value: theme },
    children,
  );
}

export function useTheme(): ThemeColors {
  return useContext(ThemeContext);
}
