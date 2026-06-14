import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import React, { useState, useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { getCurrentProfile, getProfileStats } from '../../lib/profiles'
import type { Profile, ProfileStats } from '../../lib/profiles'
import { getInitials } from '../../lib/matching'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../lib/theme'
import { useTabBarScroll } from '../../lib/useTabBarScroll'
import { showTabBar } from '../../lib/tabBarAnim'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { useBadgesStore } from '../../store/badgesStore'
const features: Array<{
  iconName: any; title: string; subtitle: string
  color: string; bg: string; border: string; route: string
}> = [
  { iconName: 'map-outline', title: 'Campus map',      subtitle: 'Events & friends nearby',        color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)',  route: '/map' },
  { iconName: 'book-outline', title: 'Academic hub',    subtitle: 'Courses, study groups & notes',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)',  route: '/academic' },
  { iconName: 'people-outline', title: 'Clubs',           subtitle: 'Join clubs & announcements',     color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)', route: '/clubs' },
  { iconName: 'game-controller-outline', title: 'Games',           subtitle: 'Pool · Trivia · Word Duel',      color: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.25)', route: '/games' },
  { iconName: 'megaphone-outline', title: 'Confession board',subtitle: 'Anonymous campus posts',         color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.25)',  route: '/anonymous' },
  { iconName: 'chatbubble-ellipses-outline', title: 'Feedback',         subtitle: 'Report issues & suggestions',    color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)',  route: '/feedback' },
  { iconName: 'pricetag-outline', title: 'Campus deals',    subtitle: 'Student-only discounts',         color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)',  route: '/vendors' },
  { iconName: 'person-outline', title: 'Edit profile',    subtitle: 'Bio, photo & interests',         color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)', route: '/edit-profile' },
]

export default function MoreScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ProfileStats>({ posts: 0, friends: 0, followers: 0, following: 0, clubs: 0 })
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()
  const theme = useTheme()
  const { onScroll, scrollEventThrottle } = useTabBarScroll()
  const counts = useBadgesStore(s => s.counts)

  const featureBadges: Record<string, number> = {
    '/academic': counts?.academic || 0,
    '/clubs': counts?.clubs_feature || 0,
    '/games': counts?.games || 0,
    '/anonymous': counts?.anonymous || 0,
    '/vendors': counts?.vendors || 0,
  }

  const loadData = React.useCallback(async () => {
    setLoading(true)
    Promise.all([getCurrentProfile(), getProfileStats()])
      .then(([p, s]) => {
        setProfile(p)
        setStats(s)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(
    React.useCallback(() => {
      loadData()
    }, [loadData])
  )

  useEffect(() => {
    if (!loading) showTabBar()
  }, [loading])

  const statItems = [
    { label: 'Posts',     value: stats?.posts ?? 0 },
    { label: 'Followers', value: stats?.followers ?? 0 },
    { label: 'Following', value: stats?.following ?? 0 },
    { label: 'Clubs',     value: stats?.clubs ?? 0 },
  ]

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={scrollEventThrottle}>

        <View style={s.header}>
          <Text style={[s.title, { color: theme.text }]}>More</Text>
          <TouchableOpacity onPress={() => router.push('/settings' as any)} style={s.settingsBtn}>
            <Ionicons name="settings-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Profile card */}
        <TouchableOpacity
          style={[s.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push('/profile' as any)}>
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
              <VerifiedBadge type={profile?.badge_type} customColor={profile?.badge_color} size={16} />
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
            <TouchableOpacity
              key={i}
              style={[s.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => {
                if (stat.label === 'Followers') router.push(`/followers/${profile?.id || user?.id}` as any)
                else if (stat.label === 'Following') router.push(`/following/${profile?.id || user?.id}` as any)
              }}>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Features horizontal list */}
        <Text style={[s.sectionTitle, { color: theme.textMuted }]}>Features</Text>
        <View style={[s.featuresList, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {features.map((feature, i) => {
            const badgeCount = featureBadges[feature.route] || 0
            return (
              <TouchableOpacity
                key={i}
                style={[
                  s.featureRow, 
                  i === features.length - 1 && { borderBottomWidth: 0 }, 
                  { borderBottomColor: theme.border2 }
                ]}
                onPress={() => router.push(feature.route as any)}>
                <View style={[s.featureIconWrap, { backgroundColor: feature.bg, borderColor: feature.border }]}>
                  <Ionicons name={feature.iconName} size={20} color={feature.color} />
                </View>
                <View style={s.featureTextWrap}>
                  <Text style={[s.featureTitle, { color: theme.text }]}>{feature.title}</Text>
                  <Text style={[s.featureSub, { color: theme.textMuted }]}>{feature.subtitle}</Text>
                </View>
                {badgeCount > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                  </View>
                )}
                <Text style={[s.featureArrow, { color: theme.textMuted }]}>›</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  settingsBtn: { padding: 4 },

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
  featuresList: {
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 28, borderWidth: 0.5, overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
    borderBottomWidth: 0.5,
  },
  featureIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5,
  },
  featureIcon: { fontSize: 16 },
  featureTextWrap: { flex: 1 },
  featureTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  featureSub: { fontSize: 11 },
  featureArrow: { fontSize: 20 },
  badge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
})
