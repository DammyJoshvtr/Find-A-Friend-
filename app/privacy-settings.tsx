import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTheme } from '../lib/theme'

export default function PrivacySettingsScreen() {
  const theme = useTheme()
  const [publicProfile, setPublicProfile] = useState(true)
  const [showOnlineStatus, setShowOnlineStatus] = useState(true)
  const [allowMessages, setAllowMessages] = useState(true)
  const [showInSearch, setShowInSearch] = useState(true)
  const [anonymousByDefault, setAnonymousByDefault] = useState(false)

  const settings = [
    {
      section: 'Profile',
      items: [
        {
          icon: '👁️', label: 'Public profile',
          sub: 'Anyone on FAF can see your profile',
          value: publicProfile, onToggle: setPublicProfile,
        },
        {
          icon: '🔍', label: 'Appear in search',
          sub: 'Other students can find you by name',
          value: showInSearch, onToggle: setShowInSearch,
        },
        {
          icon: '🟢', label: 'Show online status',
          sub: 'Let others see when you\'re active',
          value: showOnlineStatus, onToggle: setShowOnlineStatus,
        },
      ],
    },
    {
      section: 'Messaging',
      items: [
        {
          icon: '💬', label: 'Allow messages',
          sub: 'Let any student send you a message',
          value: allowMessages, onToggle: setAllowMessages,
        },
      ],
    },
    {
      section: 'Posts',
      items: [
        {
          icon: '🎭', label: 'Anonymous by default',
          sub: 'New posts default to anonymous mode',
          value: anonymousByDefault, onToggle: setAnonymousByDefault,
        },
      ],
    },
  ]

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Privacy Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={{ flex: 1, padding: 16, gap: 20 }}>
        {settings.map(section => (
          <View key={section.section}>
            <Text style={[s.sectionLabel, { color: theme.textMuted }]}>{section.section.toUpperCase()}</Text>
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {section.items.map((item, i) => (
                <View
                  key={item.label}
                  style={[
                    s.row,
                    i < section.items.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.border2 },
                  ]}>
                  <Text style={s.icon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.label, { color: theme.text }]}>{item.label}</Text>
                    <Text style={[s.sub, { color: theme.textMuted }]}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={item.value}
                    onValueChange={item.onToggle}
                    thumbColor={item.value ? theme.accent : '#ccc'}
                    trackColor={{ false: theme.card2, true: theme.accentBg }}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[s.dangerRow, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }]}
          onPress={() => Alert.alert('Block list', 'You have no blocked users.')}>
          <Text style={s.icon}>🚫</Text>
          <Text style={[s.label, { flex: 1, color: theme.danger }]}>Blocked users</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.danger} />
        </TouchableOpacity>
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
  sectionLabel: { fontSize: 11, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5 },
  card: { borderRadius: 14, borderWidth: 0.5, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  dangerRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12, borderRadius: 14, borderWidth: 0.5,
  },
  icon: { fontSize: 18 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  sub: { fontSize: 12 },
})
