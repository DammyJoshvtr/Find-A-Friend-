import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

import { useThemeStore } from '../store/themeStore'
import { LIGHT, DARK, DARKER } from '../lib/theme'

interface Props {
  children: React.ReactNode
  fallbackLabel?: string
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  reset = () => this.setState({ hasError: false, message: '' })

  render() {
    if (!this.state.hasError) return this.props.children
    
    const mode = useThemeStore.getState().mode
    const theme = mode === 'light' ? LIGHT : (mode === 'darker' ? DARKER : DARK)

    return (
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        <Text style={s.emoji}>⚠️</Text>
        <Text style={[s.title, { color: theme.text }]}>{this.props.fallbackLabel ?? 'Something went wrong'}</Text>
        <Text style={[s.message, { color: theme.textMuted }]}>{this.state.message}</Text>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}
          onPress={this.reset}>
          <Text style={[s.btnText, { color: theme.accent }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    )
  }
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 40, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  btn: { borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, borderWidth: 0.5 },
  btnText: { fontSize: 14, fontWeight: '600' },
})
