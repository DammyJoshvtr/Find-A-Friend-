import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { getAllProfiles, getCurrentProfile } from '../../lib/profiles'
import { calculateMatchScore, getInitials } from '../../lib/matching'
import { sendConnectionRequest } from '../../lib/connections'
import { Alert } from 'react-native'

const filters = ['All', 'Music', 'Tech', 'Art', 'Sports', 'Gaming', 'Design', 'Dance']

export default function DiscoverScreen() {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [myProfile, setMyProfile] = useState(null)

  useEffect(() => { loadPeople() }, [])

  const loadPeople = async () => {
    try {
      const [profiles, profile] = await Promise.all([
        getAllProfiles(),
        getCurrentProfile(),
      ])
      setMyProfile(profile)
      const withScores = profiles.map((p) => ({
        ...p,
        matchScore: calculateMatchScore(
          profile?.interests ?? [],
          p.interests ?? []
        ),
      })).sort((a, b) => b.matchScore - a.matchScore)
      setPeople(withScores)
    } catch (error) {
      console.log('Discover error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (userId, name) => {
    const { error } = await sendConnectionRequest(userId)
    if (error === 'already_sent') {
      Alert.alert('Already sent', 'You already sent a request to ' + name)
    } else if (error) {
      Alert.alert('Error', 'Could not send request')
    } else {
      Alert.alert('Request sent!', 'Connection request sent to ' + name)
    }
  }

  const filtered = people.filter((p) => {
    const matchSearch = !search ||
      (p.full_name && p.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (p.department && p.department.toLowerCase().includes(search.toLowerCase()))
    const matchFilter = activeFilter === 'All' ||
      (p.interests && p.interests.includes(activeFilter))
    return matchSearch && matchFilter
  })

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Discover</Text>
        <Text style={s.subtitle}>Matched to your interests</Text>
      </View>

      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={16} color="rgba(240,240,255,0.3)" />
        <TextInput
          placeholder="Search students, interests..."
          placeholderTextColor="rgba(240,240,255,0.3)"
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
        {filters.map((f, i) => (
          <TouchableOpacity key={i}
            style={[s.chip, activeFilter === f && s.chipActive]}
            onPress={() => setActiveFilter(f)}>
            <Text style={[s.chipText, activeFilter === f && s.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color="#a78bfa" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>🔍</Text>
          <Text style={s.emptyTitle}>No students found</Text>
          <Text style={s.emptyText}>Try a different search or filter</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filtered.map((person, i) => (
            <View key={person.id || i} style={s.card}>
              <View style={s.cardTop}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{getInitials(person.full_name || person.email)}</Text>
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.name}>{person.full_name || person.email?.split('@')[0]}</Text>
                  <Text style={s.dept}>{person.department || 'Student'}{person.level ? ' · ' + person.level : ''}</Text>
                  <View style={s.matchBadge}>
                    <Text style={s.matchText}>{person.matchScore}% match</Text>
                  </View>
                </View>
              </View>
              {person.interests && person.interests.length > 0 && (
                <View style={s.tags}>
                  {person.interests.slice(0, 3).map((tag, j) => (
                    <View key={j} style={s.tag}>
                      <Text style={s.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={s.actions}>
                <TouchableOpacity style={s.btnPri}
                  onPress={() => handleConnect(person.id, person.full_name || 'this person')}>
                  <Text style={s.btnPriText}>Connect</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSec}>
                  <Text style={s.btnSecText}>View profile</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#f0f0ff' },
  subtitle: { fontSize: 12, color: 'rgba(240,240,255,0.4)', marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1c1c2e', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, fontSize: 13, color: '#f0f0ff' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1c1c2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  chipActive: { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.35)' },
  chipText: { fontSize: 12, color: 'rgba(240,240,255,0.4)' },
  chipTextActive: { color: '#a78bfa', fontWeight: '500' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60, gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.4)' },
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#1c1c2e', borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  cardTop: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2a1e40', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#a78bfa' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#c4b5fd' },
  cardInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#f0f0ff', marginBottom: 2 },
  dept: { fontSize: 12, color: 'rgba(240,240,255,0.4)', marginBottom: 6 },
  matchBadge: { backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)' },
  matchText: { fontSize: 11, color: '#a78bfa', fontWeight: '600' },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  tag: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, color: 'rgba(240,240,255,0.5)' },
  actions: { flexDirection: 'row', gap: 8 },
  btnPri: { flex: 1, backgroundColor: '#a78bfa', borderRadius: 22, paddingVertical: 9, alignItems: 'center' },
  btnPriText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  btnSec: { flex: 1, borderRadius: 22, paddingVertical: 9, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  btnSecText: { fontSize: 13, color: 'rgba(240,240,255,0.4)' },
})
