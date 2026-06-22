import {
  View, Text, StyleSheet, TouchableOpacity
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../lib/theme'

export default function MapScreen() {
  const theme = useTheme()

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[s.backBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Campus Map</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.comingSoonContainer}>
        <View style={[s.iconCircle, { backgroundColor: `${theme.accent}12`, borderColor: theme.accentBorder }]}>
          <Ionicons name="map-outline" size={48} color={theme.accent} />
        </View>
        <Text style={[s.comingSoonTitle, { color: theme.text }]}>Map Screen Coming Soon</Text>
        <Text style={[s.comingSoonSub, { color: theme.textMuted }]}>
          We are currently mapping out the campus layout. Stay tuned to discover nearby classmates and local campus events in real time!
        </Text>
        <TouchableOpacity
          style={[s.actionButton, { backgroundColor: theme.accent }]}
          onPress={() => router.back()}
        >
          <Text style={s.actionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  title: { fontSize: 18, fontWeight: '700' },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  comingSoonSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  actionButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    width: '80%',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
})