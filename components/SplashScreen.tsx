import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useTheme } from '../lib/theme'

/**
 * Custom splash screen shown while the app is initializing.
 * Displayed by _layout.tsx before the session check resolves.
 */
export default function SplashScreen() {
  const theme = useTheme()
  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={[s.logoCircle, { backgroundColor: theme.accentBg, borderColor: theme.accent }]}>
        <Text style={[s.logoText, { color: theme.accent }]}>FAF</Text>
      </View>
      <Text style={[s.tagline, { color: theme.text }]}>Find A Friend</Text>
      <ActivityIndicator color={theme.accent} size="small" style={s.spinner} />
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
  },
  spinner: {
    marginTop: 8,
  },
})
