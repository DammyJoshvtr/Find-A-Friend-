import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const people = [
  { initials: 'AO', name: 'Aisha Okafor', dept: 'Law · 200L', match: 94, tags: ['Music', 'Debate', 'Hiking'], bg: '#2a1e40' },
  { initials: 'CB', name: 'Chidi Bello', dept: 'CS · 300L', match: 88, tags: ['Gaming', 'Tech', 'Open Source'], bg: '#1e2a20' },
  { initials: 'FN', name: 'Fatima Nwosu', dept: 'Medicine · 100L', match: 82, tags: ['Dance', 'Fitness', 'Poetry'], bg: '#1e2030' },
  { initials: 'TI', name: 'Tobi Ibeh', dept: 'Architecture · 400L', match: 79, tags: ['Design', 'Art', 'Photography'], bg: '#2a2010' },
  { initials: 'EM', name: 'Emeka Madu', dept: 'Engineering · 300L', match: 75, tags: ['Robotics', 'Chess', 'Music'], bg: '#10202a' },
]

const filters = ['All', 'Music', 'Tech', 'Art', 'Sports', 'Culture']

export default function DiscoverScreen() {
  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <Text style={s.title}>Discover</Text>
          <Text style={s.subtitle}>Matched to your interests</Text>
        </View>

        <View style={s.searchBar}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Search students, interests..."
            placeholderTextColor="rgba(240,240,255,0.3)"
            style={s.searchInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
          {filters.map((f, i) => (
            <TouchableOpacity
              key={i}
              style={[s.chip, i === 0 && s.chipActive]}>
              <Text style={[s.chipText, i === 0 && s.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {people.map((p, i) => (
          <View key={i} style={s.card}>
            <View style={s.cardBanner}>
              <View style={[s.avatar, { backgroundColor: p.bg }]}>
                <Text style={s.avatarText}>{p.initials}</Text>
              </View>
              <View style={s.onlineBadge}>
                <View style={s.onlineDot} />
                <Text style={s.onlineText}>Online</Text>
              </View>
            </View>
            <View style={s.cardBody}>
              <View style={s.cardTop}>
                <View>
                  <Text style={s.name}>{p.name}</Text>
                  <Text style={s.dept}>{p.dept}</Text>
                </View>
                <Text style={s.match}>{p.match}%</Text>
              </View>
              <View style={s.tags}>
                {p.tags.map((t, j) => (
                  <View key={j} style={s.tag}>
                    <Text style={s.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={s.btnPri}>
                  <Text style={s.btnPriText}>Connect</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSec}>
                  <Text style={s.btnSecText}>View profile</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#f0f0ff' },
  subtitle: { fontSize: 12, color: 'rgba(240,240,255,0.35)', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#1c1c2e',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 13, color: '#f0f0ff' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.35)',
  },
  chipText: { fontSize: 12, color: 'rgba(240,240,255,0.4)' },
  chipTextActive: { color: '#a78bfa', fontWeight: '500' },
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardBanner: {
    height: 70,
    backgroundColor: '#1a1430',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  avatar: {
    position: 'absolute',
    bottom: -20,
    left: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#1c1c2e',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  onlineBadge: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399' },
  onlineText: { fontSize: 10, color: '#fff' },
  cardBody: { padding: 14, paddingTop: 28 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  name: { fontSize: 13, fontWeight: '600', color: '#f0f0ff' },
  dept: { fontSize: 11, color: 'rgba(240,240,255,0.35)', marginTop: 2 },
  match: { fontSize: 13, fontWeight: '700', color: '#a78bfa' },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  tag: { backgroundColor: 'rgba(167,139,250,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 10, color: '#a78bfa' },
  actions: { flexDirection: 'row', gap: 8 },
  btnPri: { flex: 1, backgroundColor: '#a78bfa', borderRadius: 22, paddingVertical: 8, alignItems: 'center' },
  btnPriText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  btnSec: { flex: 1, backgroundColor: 'rgba(167,139,250,0.12)', borderRadius: 22, paddingVertical: 8, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)' },
  btnSecText: { fontSize: 12, color: '#a78bfa' },
})