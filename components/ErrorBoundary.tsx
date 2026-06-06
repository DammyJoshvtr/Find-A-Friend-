import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

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
    // App is always dark — hardcode dark colours so this boundary never
    // depends on Appearance.getColorScheme() which would return the system
    // theme rather than the user's in-app preference.
    const bg         = '#0a0a1a'
    const textColor  = '#f0f0ff'
    const mutedColor = 'rgba(240,240,255,0.4)'
    const accentColor = '#a78bfa'

    return (
      <View style={[s.container, { backgroundColor: bg }]}>
        <Text style={s.emoji}>⚠️</Text>
        <Text style={[s.title, { color: textColor }]}>{this.props.fallbackLabel ?? 'Something went wrong'}</Text>
        <Text style={[s.message, { color: mutedColor }]}>{this.state.message}</Text>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.3)' }]}
          onPress={this.reset}>
          <Text style={[s.btnText, { color: accentColor }]}>Try again</Text>
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
