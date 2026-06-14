import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useThemeStore } from '../store/themeStore'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'

export default function AppearanceScreen() {
  const { mode, setMode } = useThemeStore()
  const theme = useTheme()

  const themes = [
    {
      label: 'Dark',
      icon: '🌑',
      value: 'dark' as const,
      description: 'Deep dark — easy on the eyes',
      active: mode === 'dark',
      onPress: () => setMode('dark'),
    },
    {
      label: 'Darker',
      icon: '⬛',
      value: 'darker' as const,
      description: 'AMOLED black — maximum contrast',
      active: mode === 'darker',
      onPress: () => setMode('darker'),
    },
  ]

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Appearance</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ padding: 16, gap: 16 }}>
        <Text style={[s.sectionLabel, { color: theme.textMuted }]}>Theme</Text>

        {themes.map(t => (
          <TouchableOpacity
            key={t.value}
            style={[
              s.themeCard,
              { backgroundColor: theme.card, borderColor: t.active ? theme.accent : theme.border },
            ]}
            onPress={t.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${t.label} theme`}>
            <View style={s.themeLeft}>
              <Text style={s.themeIcon}>{t.icon}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.themeLabel, { color: t.active ? theme.accent : theme.text }]}>
                  {t.label}
                </Text>
                <Text style={[s.themeDesc, { color: theme.textMuted }]}>
                  {t.description}
                </Text>
              </View>
            </View>
            {t.active && (
              <View style={[s.activeCheck, { backgroundColor: theme.accent }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}

        <Text style={[s.note, { color: theme.textFaint }]}>
          Both themes use a dark background optimised for night use. Darker uses near-black AMOLED colours for maximum contrast on OLED screens.
        </Text>
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
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontFamily: typography.fontSemiBold },
  sectionLabel: { fontSize: 12, fontFamily: typography.fontMedium, textTransform: 'uppercase', letterSpacing: 0.8 },
  themeCard: {
    borderRadius: 16, padding: 16, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  themeLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  themeIcon: { fontSize: 28 },
  themeLabel: { fontSize: 15, fontFamily: typography.fontSemiBold },
  themeDesc: { fontSize: 12, fontFamily: typography.fontRegular },
  activeCheck: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  note: {
    fontSize: 12, fontFamily: typography.fontRegular, lineHeight: 18,
    marginTop: 4,
  },
})
