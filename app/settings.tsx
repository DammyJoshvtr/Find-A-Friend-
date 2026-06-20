import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator
} from 'react-native'
import Toast from 'react-native-toast-message'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../store/authStore'
// import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme'
import { client } from '../lib/aws'
import * as Updates from 'expo-updates'

export default function SettingsScreen() {
  const { signOut, user } = useAuthStore()
  const theme = useTheme()

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        await signOut()
        router.replace('/(auth)/welcome' as any)
      }},
    ])
  }

  const [updating, setUpdating] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'downloading' | 'ready' | 'latest'>('idle')

  const handleCheckUpdate = async () => {
    if (updating) return
    setUpdating(true)
    setUpdateStatus('checking')

    try {
      if (!Updates.isEnabled) {
        Toast.show({ type: 'info', text1: 'Updates not available', text2: 'You are running a development build.' })
        setUpdating(false)
        setUpdateStatus('idle')
        return
      }

      Toast.show({ type: 'info', text1: '🔍 Checking for updates...', position: 'top' })
      const check = await Updates.checkForUpdateAsync()

      if (!check.isAvailable) {
        setUpdateStatus('latest')
        Toast.show({ type: 'success', text1: '✅ You are up to date!', text2: 'No new updates available.', visibilityTime: 3000 })
        setUpdating(false)
        return
      }

      setUpdateStatus('downloading')
      Toast.show({ type: 'info', text1: '⬇️ Downloading update...', text2: 'Please wait a moment.', autoHide: false })

      await Updates.fetchUpdateAsync()

      setUpdateStatus('ready')
      Toast.hide()

      Alert.alert(
        '🎉 Update ready!',
        'A new version has been downloaded. Restart now to apply it?',
        [
          { text: 'Later', style: 'cancel', onPress: () => { setUpdating(false); setUpdateStatus('ready') } },
          { text: 'Restart now', onPress: async () => { await Updates.reloadAsync() } },
        ]
      )
    } catch (err) {
      setUpdateStatus('idle')
      Toast.show({
        type: 'error',
        text1: 'Update check failed',
        text2: 'Check your connection and try again.',
        visibilityTime: 4000,
      })
      setUpdating(false)
    }
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your profile, posts, and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            if (user?.id) {
              await client.models.Profile.delete({ id: user.id })
            }
          } catch {}
          await signOut()
          Toast.show({ type: 'success', text1: 'Account deleted', text2: 'Your data has been removed.' })
          router.replace('/(auth)/welcome' as any)
        }},
      ]
    )
  }

  const menuItems = [
    {
      icon: 'bookmark-outline', label: 'Bookmarks', sub: 'Your saved posts',
      onPress: () => router.push('/bookmarks' as any),
    },
    {
      icon: 'notifications-outline', label: 'Notifications', sub: 'Manage your alerts',
      onPress: () => router.push('/notifications' as any),
    },
    {
      icon: 'lock-closed-outline', label: 'Privacy settings', sub: 'Profile visibility',
      onPress: () => router.push('/privacy-settings' as any),
    },
    {
      icon: 'moon-outline', label: 'Appearance', sub: 'Dark & darker mode',
      onPress: () => router.push('/appearance' as any),
    },
    {
      icon: 'school-outline', label: 'Verification', sub: 'University email verified',
      onPress: () => router.push('/verification' as any),
    },
    {
      icon: 'help-circle-outline', label: 'Badges Guide', sub: 'What each badge represents',
      onPress: () => router.push('/badges-info' as any),
    },
    {
      icon: 'help-circle-outline', label: 'Help & support', sub: 'FAQs and contact',
      onPress: () => router.push('/help' as any),
    },
    {
      icon: 'trash-outline', label: 'Delete account', sub: 'Permanently remove your data',
      onPress: handleDeleteAccount,
      danger: true,
    },
  ]

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <Text style={[s.sectionTitle, { color: theme.textMuted }]}>Account</Text>
        <View style={[s.menuList, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[s.menuItem, i === menuItems.length - 1 && { borderBottomWidth: 0 }, { borderBottomColor: theme.border2 }]}
              onPress={item.onPress}>
              <View style={[s.menuIconWrap, { backgroundColor: theme.border, borderColor: theme.border2, borderWidth: 0.5 }]}>
                <Ionicons name={item.icon as any} size={20} color={item.danger ? '#ef4444' : theme.text} />
              </View>
              <View style={s.menuText}>
                <Text style={[s.menuLabel, { color: item.danger ? '#ef4444' : theme.text }]}>{item.label}</Text>
                <Text style={[s.menuSub, { color: theme.textMuted }]}>{item.sub}</Text>
              </View>
              <Text style={[s.menuArrow, { color: theme.textMuted }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            s.updateBtn,
            updateStatus === 'latest' && s.updateBtnSuccess,
            updateStatus === 'ready' && s.updateBtnReady,
          ]}
          onPress={handleCheckUpdate}
          disabled={updating}
          activeOpacity={0.75}
        >
          <View style={s.updateBtnInner}>
            {updateStatus === 'checking' ? (
              <>
                <ActivityIndicator size="small" color="#a78bfa" style={{ marginRight: 8 }} />
                <Text style={s.updateBtnText}>Checking for updates...</Text>
              </>
            ) : updateStatus === 'downloading' ? (
              <>
                <ActivityIndicator size="small" color="#60a5fa" style={{ marginRight: 8 }} />
                <Text style={[s.updateBtnText, { color: '#60a5fa' }]}>Downloading update...</Text>
              </>
            ) : updateStatus === 'latest' ? (
              <>
                <Text style={s.updateBtnIcon}>✅</Text>
                <Text style={[s.updateBtnText, { color: '#34d399' }]}>You're up to date</Text>
              </>
            ) : updateStatus === 'ready' ? (
              <>
                <Text style={s.updateBtnIcon}>🎉</Text>
                <Text style={[s.updateBtnText, { color: '#fbbf24' }]}>Tap to restart & apply update</Text>
              </>
            ) : (
              <>
                <Text style={s.updateBtnIcon}>🔄</Text>
                <Text style={s.updateBtnText}>Check for updates</Text>
              </>
            )}
          </View>
          <View style={s.updateBtnMeta}>
            <Text style={[s.updateBtnVersion, { color: theme.textFaint }]}>
              {Updates.updateId ? `Build: ${Updates.updateId.slice(0, 8)}` : 'Base build · v1.0.0'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={s.versionWrap}>
          <Text style={[s.versionText, { color: theme.textFaint }]}>FAF v1.0.0</Text>
          <Text style={[s.versionText, { color: theme.textFaint }]}>
            {Updates.channel ? `Channel: ${Updates.channel}` : 'Development build'}
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 0.5 
  },
  backBtn: { padding: 8, width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitle: {
    fontSize: 13, fontWeight: '500',
    paddingHorizontal: 16, marginTop: 24, marginBottom: 12,
  },
  menuList: {
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 24, borderWidth: 0.5, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
    borderBottomWidth: 0.5,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  menuSub: { fontSize: 11 },
  menuArrow: { fontSize: 20 },
  updateBtn: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.25)',
    marginBottom: 12,
  },
  updateBtnSuccess: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderColor: 'rgba(52,211,153,0.25)',
  },
  updateBtnReady: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.35)',
  },
  updateBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  updateBtnIcon: { fontSize: 16, marginRight: 8 },
  updateBtnText: { fontSize: 14, fontWeight: '600', color: '#a78bfa' },
  updateBtnMeta: { alignItems: 'center' },
  updateBtnVersion: { fontSize: 10 },
  signOutBtn: {
    marginHorizontal: 16, backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.2)',
  },
  signOutText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  versionWrap: { alignItems: 'center', gap: 2, marginTop: 20 },
  versionText: { fontSize: 11 },
})
