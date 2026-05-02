import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getCurrentProfile, updateProfile } from '../lib/profiles'
import { getInitials } from '../lib/matching'
import { useAuthStore } from '../store/authStore'

const allInterests = [
  'Music', 'Tech', 'Art', 'Sports', 'Gaming', 'Photography',
  'Dance', 'Debate', 'Fitness', 'Poetry', 'Hiking', 'Chess',
  'Fashion', 'Film', 'Reading', 'Cooking', 'Travel', 'Design',
  'Robotics', 'Open Source', 'Drama', 'Journalism', 'Business',
]

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [interests, setInterests] = useState([])
  const { signOut } = useAuthStore()

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    const p = await getCurrentProfile()
    setProfile(p)
    setFullName(p?.full_name ?? '')
    setBio(p?.bio ?? '')
    setInterests(p?.interests ?? [])
    setLoading(false)
  }

  const saveChanges = async () => {
    setSaving(true)
    const { error } = await updateProfile({ full_name: fullName, bio, interests })
    setSaving(false)
    if (error) {
      Alert.alert('Error', String(error))
    } else {
      setEditing(false)
      loadProfile()
    }
  }

  const toggleInterest = (interest) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < 8 ? [...prev, interest] : prev
    )
  }

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        await signOut()
        router.replace('/(auth)/welcome')
      }},
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator color="#a78bfa" style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>My profile</Text>
          <TouchableOpacity style={s.editBtn} onPress={() => editing ? saveChanges() : setEditing(true)}>
            {saving ? <ActivityIndicator size="small" color="#a78bfa" /> : <Text style={s.editText}>{editing ? 'Save' : 'Edit'}</Text>}
          </TouchableOpacity>
        </View>

        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{getInitials(profile?.full_name ?? profile?.email ?? '??')}</Text>
          </View>
          <View style={s.verifiedBadge}>
            <Text style={s.verifiedText}>✓ Verified student</Text>
          </View>

          {editing ? (
            <View style={s.editFields}>
              <Text style={s.fieldLabel}>Full name</Text>
              <TextInput style={s.fieldInput} value={fullName} onChangeText={setFullName} placeholderTextColor="rgba(240,240,255,0.25)" />
              <Text style={s.fieldLabel}>Bio</Text>
              <TextInput style={[s.fieldInput, s.bioInput]} value={bio} onChangeText={setBio} multiline maxLength={160} placeholderTextColor="rgba(240,240,255,0.25)" placeholder="Tell other students about yourself..." />
            </View>
          ) : (
            <View style={s.profileInfo}>
              <Text style={s.profileName}>{profile?.full_name ?? 'Your name'}</Text>
              <Text style={s.profileDept}>{profile?.department ?? 'Department'}{profile?.level ? ' · ' + profile.level : ''}</Text>
              <Text style={s.profileEmail}>{profile?.email}</Text>
              {profile?.bio && <Text style={s.profileBio}>{profile.bio}</Text>}
            </View>
          )}
        </View>

        <View style={s.statsRow}>
          {[{ label: 'Posts', value: '0' }, { label: 'Friends', value: '0' }, { label: 'Clubs', value: '0' }, { label: 'Events', value: '0' }].map((stat, i) => (
            <View key={i} style={s.statCard}>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{editing ? 'Edit interests (max 8)' : 'Interests'}</Text>
        </View>

        <View style={s.interestsWrap}>
          {(editing ? allInterests : profile?.interests ?? []).map((interest, i) => {
            const active = interests.includes(interest)
            return (
              <TouchableOpacity key={i}
                style={[s.interestChip, active && s.interestChipActive]}
                onPress={() => editing && toggleInterest(interest)}
                disabled={!editing}>
                <Text style={[s.interestText, active && s.interestTextActive]}>{interest}</Text>
              </TouchableOpacity>
            )
          })}
          {!editing && (!profile?.interests || profile.interests.length === 0) && (
            <Text style={s.noInterests}>No interests added yet. Tap Edit to add some!</Text>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>
        </View>

        <View style={s.menuList}>
          {[
            { icon: 'notifications-outline', label: 'Notifications' },
            { icon: 'lock-closed-outline', label: 'Privacy settings' },
            { icon: 'moon-outline', label: 'Appearance' },
            { icon: 'help-circle-outline', label: 'Help & support' },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={s.menuItem}>
              <Ionicons name={item.icon} size={20} color="rgba(240,240,255,0.6)" />
              <Text style={s.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(240,240,255,0.2)" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  back: { fontSize: 14, color: '#a78bfa' },
  title: { fontSize: 18, fontWeight: '700', color: '#f0f0ff' },
  editBtn: { backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)' },
  editText: { fontSize: 13, color: '#a78bfa', fontWeight: '500' },
  profileCard: { marginHorizontal: 16, marginBottom: 14, backgroundColor: '#1c1c2e', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2a1e40', alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 2, borderColor: '#a78bfa' },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#c4b5fd' },
  verifiedBadge: { backgroundColor: 'rgba(52,211,153,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.3)', marginBottom: 12 },
  verifiedText: { fontSize: 11, color: '#34d399', fontWeight: '500' },
  profileInfo: { alignItems: 'center', gap: 4 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#f0f0ff' },
  profileDept: { fontSize: 13, color: 'rgba(240,240,255,0.5)' },
  profileEmail: { fontSize: 12, color: 'rgba(240,240,255,0.3)' },
  profileBio: { fontSize: 13, color: 'rgba(240,240,255,0.6)', textAlign: 'center', lineHeight: 20, marginTop: 6 },
  editFields: { width: '100%', gap: 10 },
  fieldLabel: { fontSize: 11, color: 'rgba(240,240,255,0.4)', fontWeight: '500', marginBottom: 4 },
  fieldInput: { backgroundColor: '#0d0d14', borderRadius: 10, padding: 12, fontSize: 14, color: '#f0f0ff', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  bioInput: { height: 80, textAlignVertical: 'top' },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 20, gap: 8 },
  statCard: { flex: 1, backgroundColor: '#1c1c2e', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#a78bfa', marginBottom: 2 },
  statLabel: { fontSize: 10, color: 'rgba(240,240,255,0.35)' },
  section: { paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '500', color: 'rgba(240,240,255,0.5)' },
  interestsWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 20 },
  interestChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1c1c2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  interestChipActive: { backgroundColor: 'rgba(167,139,250,0.2)', borderColor: '#a78bfa' },
  interestText: { fontSize: 13, color: 'rgba(240,240,255,0.4)' },
  interestTextActive: { color: '#a78bfa', fontWeight: '600' },
  noInterests: { fontSize: 13, color: 'rgba(240,240,255,0.25)', fontStyle: 'italic' },
  menuList: { marginHorizontal: 16, backgroundColor: '#1c1c2e', borderRadius: 16, marginBottom: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  menuLabel: { flex: 1, fontSize: 14, color: '#f0f0ff' },
  signOutBtn: { marginHorizontal: 16, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.2)' },
  signOutText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
})
