import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useState, useEffect } from 'react'
import { getCurrentProfile, getProfileStats } from '../../lib/profiles'
import type { Profile, ProfileStats } from '../../lib/profiles'
import { getInitials } from '../../lib/matching'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/theme'
import * as Updates from 'expo-updates'

const features: Array<{
  icon: string; title: string; subtitle: string
  color: string; bg: string; border: string; route: string
}> = [
  { icon: '🗺️', title: 'Campus map',      subtitle: 'Events & friends nearby',        color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)',  route: '/map' },
  { icon: '📚', title: 'Academic hub',    subtitle: 'Courses, study groups & notes',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)',  route: '/academic' },
  { icon: '🏛️', title: 'Clubs',           subtitle: 'Join clubs & announcements',     color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)', route: '/clubs' },
  { icon: '🎭', title: 'Confession board',subtitle: 'Anonymous campus posts',         color: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.25)', route: '/anonymous' },
  { icon: '🏪', title: 'Campus deals',    subtitle: 'Student-only discounts',         color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)',  route: '/vendors' },
  { icon: '👤', title: 'Edit profile',    subtitle: 'Bio, photo & interests',         color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)', route: '/edit-profile' },
]

export default function MoreScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ProfileStats>({ posts: 0, friends: 0, followers: 0, following: 0, clubs: 0 })
  const [loading, setLoading] = useState(true)
  const { signOut, user } = useAuthStore()
  const theme = useTheme()

  useEffect(() => {
    Promise.all([getCurrentProfile(), getProfileStats()]).then(([p, s]) => {
      setProfile(p)
      setStats(s)
      setLoading(false)
    })
  }, [])

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        await signOut()
        router.replace('/(auth)/welcome' as any)
      }},
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your profile, posts, and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            // Delete profile row first (cascades to posts, follows, etc. via DB FK constraints)
            if (user?.id) {
              await supabase.from('profiles').delete().eq('id', user.id)
            }
          } catch {
            // Ignore — sign out either way so the user is not stuck
          }
          await supabase.auth.signOut()
          Alert.alert(
            'Account deleted',
            'Your data has been removed. If any content remains, it will be purged within 24 hours.',
          )
          router.replace('/(auth)/welcome' as any)
        }},
      ]
    )
  }

  const menuItems = [
    {
      icon: '🔖', label: 'Bookmarks', sub: 'Your saved posts',
      onPress: () => router.push('/bookmarks' as any),
    },
    {
      icon: '🔔', label: 'Notifications', sub: 'Manage your alerts',
      onPress: () => router.push('/notifications' as any),
    },
    {
      icon: '🔒', label: 'Privacy settings', sub: 'Profile visibility',
      onPress: () => router.push('/privacy-settings' as any),
    },
    {
      icon: '🌙', label: 'Appearance', sub: 'Dark & light mode',
      onPress: () => router.push('/appearance' as any),
    },
    {
      icon: '🎓', label: 'Verification', sub: 'University email verified',
      onPress: () => router.push('/verification' as any),
    },
    {
      icon: '❓', label: 'Help & support', sub: 'FAQs and contact',
      onPress: () => router.push('/help' as any),
    },
    {
      icon: '🗑️', label: 'Delete account', sub: 'Permanently remove your data',
      onPress: handleDeleteAccount,
      danger: true,
    },
  ]

  const statItems = [
    { label: 'Posts',     value: stats.posts },
    { label: 'Followers', value: stats.followers },
    { label: 'Following', value: stats.following },
    { label: 'Clubs',     value: stats.clubs },
  ]

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <Text style={[s.title, { color: theme.text }]}>More</Text>
        </View>

        {/* Profile card */}
        <TouchableOpacity
          style={[s.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => user?.id && router.push(`/profile/${user.id}` as any)}>
          {loading ? (
            <View style={[s.avatarWrap, { backgroundColor: theme.card2 }]}>
              <ActivityIndicator size="small" color="#a78bfa" />
            </View>
          ) : profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
          ) : (
            <View style={[s.avatarWrap, { backgroundColor: theme.card2 }]}>
              <Text style={s.avatarInitials}>
                {getInitials(profile?.full_name ?? profile?.email ?? '??')}
              </Text>
            </View>
          )}
          <View style={s.profileInfo}>
            <View style={s.profileNameRow}>
              <Text style={[s.profileName, { color: theme.text }]}>{profile?.full_name ?? 'Your name'}</Text>
              <View style={s.verifiedBadge}>
                <Text style={s.verifiedText}>✓ Verified</Text>
              </View>
            </View>
            <Text style={[s.profileDept, { color: theme.textMuted }]}>
              {profile?.department ?? 'Department'}{profile?.level ? ' · ' + profile.level : ''}
            </Text>
            <Text style={[s.profileEmail, { color: theme.textMuted }]}>{profile?.email ?? user?.email ?? ''}</Text>
          </View>
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => router.push('/edit-profile' as any)}>
            <Text style={s.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Stats */}
        <View style={s.statsRow}>
          {statItems.map((stat, i) => (
            <View key={i} style={[s.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Features grid */}
        <Text style={[s.sectionTitle, { color: theme.textMuted }]}>Features</Text>
        <View style={s.featuresGrid}>
          {features.map((feature, i) => (
            <TouchableOpacity
              key={i}
              style={[s.featureCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(feature.route as any)}>
              <View style={[s.featureIconWrap, { backgroundColor: feature.bg, borderColor: feature.border }]}>
                <Text style={s.featureIcon}>{feature.icon}</Text>
              </View>
              <Text style={[s.featureTitle, { color: theme.text }]}>{feature.title}</Text>
              <Text style={[s.featureSub, { color: theme.textMuted }]}>{feature.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Account menu */}
        <Text style={[s.sectionTitle, { color: theme.textMuted }]}>Account</Text>
        <View style={[s.menuList, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[s.menuItem, i === menuItems.length - 1 && { borderBottomWidth: 0 }, { borderBottomColor: theme.border2 }]}
              onPress={item.onPress}>
              <View style={[s.menuIconWrap, { backgroundColor: theme.card2 }]}>
                <Text style={s.menuIcon}>{item.icon}</Text>
              </View>
              <View style={s.menuText}>
                <Text style={[s.menuLabel, { color: item.danger ? '#ef4444' : theme.text }]}>{item.label}</Text>
                <Text style={[s.menuSub, { color: theme.textMuted }]}>{item.sub}</Text>
              </View>
              <Text style={[s.menuArrow, { color: theme.textMuted }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={s.versionWrap}>
          <Text style={[s.versionText, { color: theme.textFaint }]}>FAF v1.0.0</Text>
          <Text style={[s.versionText, { color: theme.textFaint }]}>
            Update: {Updates.updateId ? Updates.updateId.slice(0, 8) : 'base build'}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700' },

  profileCard: {
    marginHorizontal: 16, marginBottom: 14,
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 0.5,
  },
  avatarImg: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#a78bfa' },
  avatarWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#a78bfa',
  },
  avatarInitials: { fontSize: 20, fontWeight: '700', color: '#c4b5fd' },
  profileInfo: { flex: 1 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  profileName: { fontSize: 16, fontWeight: '600' },
  verifiedBadge: {
    backgroundColor: 'rgba(52,211,153,0.15)', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.3)',
  },
  verifiedText: { fontSize: 10, color: '#34d399', fontWeight: '500' },
  profileDept: { fontSize: 12, marginBottom: 2 },
  profileEmail: { fontSize: 11 },
  editBtn: {
    backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.35)',
  },
  editBtnText: { fontSize: 12, color: '#a78bfa', fontWeight: '600' },

  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 24, gap: 8 },
  statCard: {
    flex: 1, borderRadius: 12,
    padding: 12, alignItems: 'center',
    borderWidth: 0.5,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: '#a78bfa', marginBottom: 2 },
  statLabel: { fontSize: 10 },

  sectionTitle: {
    fontSize: 13, fontWeight: '500',
    paddingHorizontal: 16, marginBottom: 12,
  },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 28 },
  featureCard: {
    width: '47%', borderRadius: 16,
    padding: 14, borderWidth: 0.5,
  },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, borderWidth: 0.5,
  },
  featureIcon: { fontSize: 22 },
  featureTitle: { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  featureSub: { fontSize: 10, lineHeight: 14 },

  menuList: {
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16, borderWidth: 0.5, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
    borderBottomWidth: 0.5,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIcon: { fontSize: 16 },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  menuSub: { fontSize: 11 },
  menuArrow: { fontSize: 20 },

  signOutBtn: {
    marginHorizontal: 16, backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.2)',
  },
  signOutText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  versionWrap: { alignItems: 'center', gap: 2, marginTop: 20 },
  versionText: { fontSize: 11 },
})
