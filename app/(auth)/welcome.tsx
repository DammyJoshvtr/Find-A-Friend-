import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '../../lib/theme'

export default function WelcomeScreen() {
  const theme = useTheme()
  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={s.content}>

        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Text style={s.logoText}>FAF</Text>
          </View>
          <Text style={s.tagline}>Find A Friend</Text>
          <Text style={s.sub}>Your campus social universe</Text>
        </View>

        <View style={s.features}>
          {[
            { icon: '🎓', text: 'Verified students only' },
            { icon: '🧠', text: 'Smart interest matching' },
            { icon: '📅', text: 'Live campus events' },
            { icon: '💬', text: 'Real-time messaging' },
            { icon: '🏛️', text: 'Clubs & societies hub' },
            { icon: '🗺️', text: 'Live campus map' },
          ].map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <Text style={s.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={s.actions}>
          <TouchableOpacity
            style={s.btnPrimary}
            onPress={() => router.push('/(auth)/verify')}>
            <Text style={s.btnPrimaryText}>Get started with university email</Text>
          </TouchableOpacity>
          <Text style={s.disclaimer}>
            Only students with a valid university email can join FAF
          </Text>
        </View>

      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingVertical: 20 },
  logoWrap: { alignItems: 'center', paddingTop: 40 },
  logoCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 2, borderColor: '#a78bfa',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { fontSize: 32, fontWeight: '800', color: '#a78bfa' },
  tagline: { fontSize: 28, fontWeight: '700', color: '#f0f0ff', marginBottom: 6 },
  sub: { fontSize: 15, color: 'rgba(240,240,255,0.45)' },
  features: {
    backgroundColor: '#1c1c2e',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { fontSize: 20, width: 28 },
  featureText: { fontSize: 14, color: 'rgba(240,240,255,0.7)', fontWeight: '500' },
  actions: { gap: 12 },
  btnPrimary: {
    backgroundColor: '#a78bfa',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  disclaimer: {
    fontSize: 12,
    color: 'rgba(240,240,255,0.3)',
    textAlign: 'center',
    lineHeight: 18,
  },
})