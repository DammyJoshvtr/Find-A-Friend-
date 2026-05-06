import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useThemeStore } from '../store/themeStore'
import { useTheme } from '../lib/theme'

export default function AppearanceScreen() {
  const { isDark, toggleTheme } = useThemeStore()
  const theme = useTheme()

  const options = [
    { label: 'Dark mode', icon: '🌙', value: isDark, onToggle: toggleTheme },
  ]

  const themes = [
    { label: 'Dark',   icon: '🌑', active: isDark,  onPress: () => { if (!isDark) toggleTheme() } },
    { label: 'Light',  icon: '☀️', active: !isDark, onPress: () => { if (isDark) toggleTheme() } },
  ]

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Appearance</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={{ padding: 16, gap: 16 }}>
        {/* Theme picker */}
        <Text style={[s.sectionLabel, { color: theme.textMuted }]}>Theme</Text>
        <View style={s.themeRow}>
          {themes.map(t => (
            <TouchableOpacity
              key={t.label}
              style={[
                s.themeCard,
                { backgroundColor: theme.card, borderColor: t.active ? theme.accent : theme.border },
              ]}
              onPress={t.onPress}>
              <Text style={s.themeIcon}>{t.icon}</Text>
              <Text style={[s.themeLabel, { color: t.active ? theme.accent : theme.textMuted }]}>
                {t.label}
              </Text>
              {t.active && (
                <View style={[s.activeCheck, { backgroundColor: theme.accent }]}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Toggle row */}
        <View style={[s.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={s.rowIcon}>🌙</Text>
          <Text style={[s.rowLabel, { color: theme.text }]}>Dark mode</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            thumbColor={isDark ? theme.accent : '#ccc'}
            trackColor={{ false: theme.card2, true: theme.accentBg }}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '500', marginBottom: -8 },
  themeRow: { flexDirection: 'row', gap: 12 },
  themeCard: {
    flex: 1, borderRadius: 16, padding: 20, alignItems: 'center',
    gap: 8, borderWidth: 1.5, position: 'relative',
  },
  themeIcon: { fontSize: 32 },
  themeLabel: { fontSize: 14, fontWeight: '600' },
  activeCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 0.5,
  },
  rowIcon: { fontSize: 18 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
})
