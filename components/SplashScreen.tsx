import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'

/**
 * Custom splash screen shown while the app is initializing.
 * Displayed by _layout.tsx before the session check resolves.
 */
export default function SplashScreen() {
  return (
    <View style={s.container}>
      <View style={s.logoCircle}>
        <Text style={s.logoText}>FAF</Text>
      </View>
      <Text style={s.tagline}>Find A Friend</Text>
      <ActivityIndicator color="#a78bfa" size="small" style={s.spinner} />
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d14',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 2,
    borderColor: '#a78bfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#a78bfa',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(240,240,255,0.45)',
    fontWeight: '500',
  },
  spinner: {
    marginTop: 8,
  },
})
