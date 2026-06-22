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
  card: "rgba(255,255,255,0.9)",
  cardSolid: "#ffffff",
  card2: "#f1f5f9",

  text: "#0f172a",
  textMuted: "#64748b",
  textFaint: "#94a3b8",

  border: "#cbd5e1",
  border2: "#e2e8f0",
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
  dark: false,
  cardShadow: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};

// Dark mode — the standard deep dark theme
export const DARK = {
  bg: "#0a0a1a",
  card: "rgba(255,255,255,0.055)",
  cardSolid: "#0f0f2a",
  card2: "#24243a",
  text: "#f0f0ff",
  textMuted: "rgba(240,240,255,0.55)",
  textFaint: "rgba(240,240,255,0.2)",
  border: "rgba(255,255,255,0.13)",
  border2: "rgba(255,255,255,0.07)",
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
  dark: true,
  cardShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
};

// Darker mode — near-black "amoled" variant
export const DARKER = {
  bg: "#050508",
  card: "rgba(255,255,255,0.045)",
  cardSolid: "#08080f",
  card2: "#14141e",
  text: "#f0f0ff",
  textMuted: "rgba(240,240,255,0.55)",
  textFaint: "rgba(240,240,255,0.2)",
  border: "rgba(255,255,255,0.1)",
  border2: "rgba(255,255,255,0.05)",
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
  dark: true,
  cardShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
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
  dark: boolean;
  cardShadow: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
};

const ThemeContext = createContext<ThemeColors>(LIGHT);

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
