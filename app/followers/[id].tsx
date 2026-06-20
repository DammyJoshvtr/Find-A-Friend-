import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { client } from '../../lib/aws'
import { getInitials } from '../../lib/matching'
import { useTheme } from '../../lib/theme'

interface FollowerProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  department: string | null
}

export default function FollowersScreen() {
  const theme = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [followers, setFollowers] = useState<FollowerProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadFollowers()
  }, [id])

  const loadFollowers = async () => {
    setLoading(true)
    try {
      const { data } = await client.models.follows.list({ filter: { following_id: { eq: id } } }) // TODO: Complex select
      const profiles = (data ?? [])
        .map((r: any) => r.profiles)
        .filter(Boolean) as FollowerProfile[]
      setFollowers(profiles)
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Followers</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={followers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.row, { borderBottomColor: theme.border }]}
              onPress={() => router.push(`/profile/${item.id}` as any)}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={s.avatar} />
              ) : (
                <View style={[s.avatarFallback, { backgroundColor: theme.card2 }]}>
                  <Text style={[s.avatarInitials, { color: theme.accent }]}>
                    {getInitials(item.full_name ?? '??')}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { color: theme.text }]}>{item.full_name ?? 'Student'}</Text>
                {item.department && (
                  <Text style={[s.dept, { color: theme.textMuted }]}>{item.department}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: theme.textMuted }]}>No followers yet</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 0.5,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 15, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  dept: { fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14 },
})
