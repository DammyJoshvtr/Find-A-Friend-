/**
 * app/(tabs)/events.tsx
 * Events tab — Upcoming | My RSVPs | Past with FAB to create.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getEvents, getMyRsvps } from '../../lib/events'
import EventCard from '../../components/events/EventCard'
import type { Event } from '../../lib/events'

type Tab = 'upcoming' | 'rsvps' | 'past'

const TABS: { label: string; value: Tab }[] = [
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'My RSVPs', value: 'rsvps' },
  { label: 'Past', value: 'past' },
]

export default function EventsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTab(activeTab)
  }, [activeTab])

  const loadTab = async (tab: Tab) => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'upcoming') {
        const { data, error: err } = await getEvents({ upcoming: true })
        if (err) throw err
        setEvents(data ?? [])
      } else if (tab === 'past') {
        const { data, error: err } = await getEvents({ upcoming: false })
        if (err) throw err
        // Filter to past only (starts_at < now)
        const now = new Date().toISOString()
        setEvents((data ?? []).filter(e => e.starts_at < now))
      } else {
        // My RSVPs
        const { data, error: err } = await getMyRsvps()
        if (err) throw err
        setEvents((data ?? []).map(r => ({
          ...r.event,
          user_rsvp_status: r.rsvp.status,
        })))
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadTab(activeTab)
  }, [activeTab])

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Events</Text>
        <TouchableOpacity
          style={s.createBtn}
          onPress={() => router.push('/create-event' as any)}>
          <Ionicons name="add" size={18} color="#a78bfa" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.value}
            style={[s.tab, activeTab === tab.value && s.tabActive]}
            onPress={() => setActiveTab(tab.value)}>
            <Text style={[s.tabText, activeTab === tab.value && s.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : error ? (
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>Failed to load events</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => loadTab(activeTab)}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <EventCard event={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#a78bfa"
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={48} color="rgba(240,240,255,0.12)" />
              <Text style={s.emptyTitle}>
                {activeTab === 'rsvps' ? 'No RSVPs yet' : 'No events found'}
              </Text>
              <Text style={s.emptyText}>
                {activeTab === 'rsvps'
                  ? 'Browse upcoming events and RSVP!'
                  : 'Check back soon or create one.'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push('/create-event' as any)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#f0f0ff' },
  createBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1c1c2e',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#1c1c2e',
    borderRadius: 12, padding: 3,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  tab: {
    flex: 1, paddingVertical: 8,
    alignItems: 'center', borderRadius: 10,
  },
  tabActive: { backgroundColor: 'rgba(167,139,250,0.2)' },
  tabText: { fontSize: 12, color: 'rgba(240,240,255,0.4)', fontWeight: '500' },
  tabTextActive: { color: '#a78bfa', fontWeight: '600' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  retryBtn: {
    backgroundColor: '#a78bfa', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.4)', textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#a78bfa',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
})
