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
      label: 'Light',
      icon: '☀️',
      value: 'light' as const,
      description: 'Clean light layout — perfect for daytime',
      active: mode === 'light',
      onPress: () => setMode('light'),
    },
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

  const activeThemeObj = themes.find(t => t.active) || themes[1]

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

        {/* Beautified segmented select */}
        <View style={[s.selectorContainer, { backgroundColor: theme.card2, borderColor: theme.border }]}>
          {themes.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[
                s.selectorTab,
                t.active && {
                  backgroundColor: theme.cardSolid,
                  borderColor: theme.border,
                }
              ]}
              onPress={t.onPress}
              activeOpacity={0.8}
            >
              <Text style={s.selectorIcon}>{t.icon}</Text>
              <Text style={[
                s.selectorText,
                { color: t.active ? theme.accent : theme.textMuted }
              ]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.descriptionText, { color: theme.textMuted }]}>
          {activeThemeObj.description}
        </Text>

        {/* Dynamic Theme Preview Widget */}
        <Text style={[s.sectionLabel, { color: theme.textMuted, marginTop: 12 }]}>Preview</Text>
        <View style={[s.previewWidget, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[s.previewHeader, { borderBottomColor: theme.border }]}>
            <View style={s.previewUserRow}>
              <View style={[s.previewAvatar, { backgroundColor: theme.accentBg }]}>
                <Text style={[s.previewAvatarText, { color: theme.accent }]}>JD</Text>
              </View>
              <View>
                <Text style={[s.previewUsername, { color: theme.text }]}>John Doe</Text>
                <Text style={[s.previewUserStatus, { color: theme.success }]}>● Online</Text>
              </View>
            </View>
            <Ionicons name="call" size={16} color={theme.accent} />
          </View>

          {/* Messages */}
          <View style={s.previewChatBody}>
            <View style={[s.previewBubbleFriend, { backgroundColor: theme.card }]}>
              <Text style={[s.previewBubbleText, { color: theme.text }]}>
                Hey! Are we still playing pool in the game lobby today? 🎱
              </Text>
              <Text style={[s.previewBubbleTime, { color: theme.textFaint }]}>11:32 AM</Text>
            </View>

            <View style={[s.previewBubbleSelf, { backgroundColor: theme.accent }]}>
              <Text style={[s.previewBubbleText, { color: '#fff' }]}>
                Definitely! Meet you there in 10 mins. 🚀
              </Text>
              <Text style={[s.previewBubbleTime, { color: 'rgba(255,255,255,0.7)' }]}>11:33 AM</Text>
            </View>
          </View>

          {/* Input Area */}
          <View style={[s.previewInputArea, { borderTopColor: theme.border }]}>
            <View style={[s.previewInput, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>Write a message...</Text>
            </View>
            <View style={[s.previewSendBtn, { backgroundColor: theme.accent }]}>
              <Ionicons name="send" size={10} color="#fff" />
            </View>
          </View>
        </View>

        <Text style={[s.note, { color: theme.textFaint }]}>
          Choose between Light, Dark, or Darker (AMOLED) modes. Themes apply instantly across all tabs and screens.
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
  selectorContainer: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  selectorTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectorIcon: {
    fontSize: 16,
  },
  selectorText: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    textAlign: 'center',
    marginTop: -4,
  },
  note: {
    fontSize: 12, fontFamily: typography.fontRegular, lineHeight: 18,
    marginTop: 4,
  },
  previewWidget: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    paddingBottom: 8,
  },
  previewUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatarText: {
    fontSize: 10,
    fontWeight: '700',
  },
  previewUsername: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
  },
  previewUserStatus: {
    fontSize: 8,
    fontWeight: '600',
  },
  previewChatBody: {
    gap: 8,
    paddingVertical: 4,
  },
  previewBubbleFriend: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderTopLeftRadius: 2,
  },
  previewBubbleSelf: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderTopRightRadius: 2,
  },
  previewBubbleText: {
    fontSize: 11,
    lineHeight: 15,
  },
  previewBubbleTime: {
    fontSize: 8,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  previewInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 0.5,
    paddingTop: 8,
  },
  previewInput: {
    flex: 1,
    height: 24,
    borderRadius: 12,
    borderWidth: 0.5,
    paddingLeft: 10,
    justifyContent: 'center',
  },
  previewSendBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
