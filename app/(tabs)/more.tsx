import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const features = [
  {
    icon: '🗺️',
    title: 'Campus map',
    subtitle: 'Live events & friends nearby',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.25)',
  },
  {
    icon: '📚',
    title: 'Academic hub',
    subtitle: 'Courses, study groups & past questions',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.12)',
    border: 'rgba(96,165,250,0.25)',
  },
  {
    icon: '🏛️',
    title: 'Clubs & societies',
    subtitle: 'Join clubs, get announcements',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.25)',
  },
  {
    icon: '🎭',
    title: 'Confession board',
    subtitle: 'Anonymous campus posts & shoutouts',
    color: '#f472b6',
    bg: 'rgba(244,114,182,0.12)',
    border: 'rgba(244,114,182,0.25)',
  },
  {
    icon: '🏪',
    title: 'Campus deals',
    subtitle: 'Student-only discounts near you',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.25)',
  },
  {
    icon: '👤',
    title: 'My profile',
    subtitle: 'Edit your bio, photos & interests',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.25)',
  },
]

const quickStats = [
  { label: 'Friends', value: '12' },
  { label: 'Clubs', value: '3' },
  { label: 'Events', value: '7' },
  { label: 'Match %', value: '94' },
]

export default function MoreScreen() {
  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <Text style={s.title}>More</Text>
          <TouchableOpacity style={s.settingsBtn}>
            <Text style={s.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <View style={s.profileCard}>
          <View style={s.profileAvatar}>
            <Text style={s.profileInitials}>AE</Text>
          </View>
          <View style={s.profileInfo}>
            <View style={s.profileNameRow}>
              <Text style={s.profileName}>Ayomide Enoch</Text>
              <View style={s.verifiedBadge}>
                <Text style={s.verifiedText}>✓ Verified</Text>
              </View>
            </View>
            <Text style={s.profileDept}>Computer Science · 300L</Text>
            <Text style={s.profileUni}>University of Lagos</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          {quickStats.map((stat, i) => (
            <View key={i} style={s.statCard}>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Features</Text>
        </View>

        <View style={s.featuresGrid}>
          {features.map((f, i) => (
            <TouchableOpacity key={i} style={s.featureCard}>
              <View style={[s.featureIconWrap, { backgroundColor: f.bg, borderColor: f.border }]}>
                <Text style={s.featureIcon}>{f.icon}</Text>
              </View>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureSub}>{f.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Account</Text>
        </View>

        <View style={s.menuList}>
          {[
            { icon: '🔔', label: 'Notifications', sub: 'Manage your alerts' },
            { icon: '🔒', label: 'Privacy settings', sub: 'Location, visibility' },
            { icon: '🌙', label: 'Dark mode', sub: 'Currently enabled' },
            { icon: '🎓', label: 'Verification', sub: 'University email verified' },
            { icon: '❓', label: 'Help & support', sub: 'FAQs and contact' },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={s.menuItem}>
              <View style={s.menuIconWrap}>
                <Text style={s.menuIcon}>{item.icon}</Text>
              </View>
              <View style={s.menuText}>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Text style={s.menuSub}>{item.sub}</Text>
              </View>
              <Text style={s.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.signOutBtn}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#f0f0ff' },
  settingsBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1c1c2e',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  settingsIcon: { fontSize: 16 },
  profileCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileAvatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#2a1e40',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#a78bfa',
  },
  profileInitials: { fontSize: 20, fontWeight: '700', color: '#c4b5fd' },
  profileInfo: { flex: 1 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  profileName: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  verifiedBadge: {
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(52,211,153,0.3)',
  },
  verifiedText: { fontSize: 10, color: '#34d399', fontWeight: '500' },
  profileDept: { fontSize: 12, color: 'rgba(240,240,255,0.5)', marginBottom: 2 },
  profileUni: { fontSize: 11, color: 'rgba(240,240,255,0.3)' },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1c1c2e',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: '#a78bfa', marginBottom: 2 },
  statLabel: { fontSize: 10, color: 'rgba(240,240,255,0.35)' },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '500', color: 'rgba(240,240,255,0.4)' },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 24,
  },
  featureCard: {
    width: '47%',
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 0.5,
  },
  featureIcon: { fontSize: 22 },
  featureTitle: { fontSize: 13, fontWeight: '600', color: '#f0f0ff', marginBottom: 3 },
  featureSub: { fontSize: 10, color: 'rgba(240,240,255,0.35)', lineHeight: 14 },
  menuList: {
    marginHorizontal: 16,
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#24243a',
    alignItems: 'center', justifyContent: 'center',
  },
  menuIcon: { fontSize: 16 },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 13, fontWeight: '500', color: '#f0f0ff', marginBottom: 2 },
  menuSub: { fontSize: 11, color: 'rgba(240,240,255,0.35)' },
  menuArrow: { fontSize: 20, color: 'rgba(240,240,255,0.2)' },
  signOutBtn: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  signOutText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
})