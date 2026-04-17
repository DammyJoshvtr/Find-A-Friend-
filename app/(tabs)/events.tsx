import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const dates = [
  { day: 'Mon', num: '14' },
  { day: 'Tue', num: '15' },
  { day: 'Wed', num: '16', active: true },
  { day: 'Thu', num: '17' },
  { day: 'Fri', num: '18' },
  { day: 'Sat', num: '19' },
]

const events = [
  {
    month: 'APR', day: '16', title: 'Annual Tech Expo 2026',
    venue: 'Engineering Hall', time: '10am – 4pm',
    category: 'Technology', attending: 42, color: '#a78bfa',
    bg: 'rgba(167,139,250,0.12)',
  },
  {
    month: 'APR', day: '16', title: 'Spoken Word Night',
    venue: 'Arts Centre', time: '6pm – 9pm',
    category: 'Culture', attending: 28, color: '#f472b6',
    bg: 'rgba(244,114,182,0.12)',
  },
  {
    month: 'APR', day: '16', title: 'Football Intramural Finals',
    venue: 'Sports Complex', time: '4pm',
    category: 'Sports', attending: 85, color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
  },
  {
    month: 'APR', day: '17', title: 'Photography Exhibition',
    venue: 'Gallery Block', time: '2pm – 7pm',
    category: 'Art', attending: 19, color: '#60a5fa',
    bg: 'rgba(96,165,250,0.12)',
  },
  {
    month: 'APR', day: '17', title: 'Debate Club Open Night',
    venue: 'Law Faculty Hall', time: '5pm – 8pm',
    category: 'Academic', attending: 33, color: '#fbbf24',
    bg: 'rgba(251,191,36,0.12)',
  },
]

export default function EventsScreen() {
  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <Text style={s.title}>Events</Text>
          <TouchableOpacity style={s.filterBtn}>
            <Text style={s.filterText}>Filter ▾</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
          {dates.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={[s.datePill, d.active && s.datePillActive]}>
              <Text style={s.dateDay}>{d.day}</Text>
              <Text style={[s.dateNum, d.active && s.dateNumActive]}>{d.num}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Today · Wednesday 16 Apr</Text>
        </View>

        {events.map((e, i) => (
          <TouchableOpacity key={i} style={s.eventCard}>
            <View style={s.eventDate}>
              <Text style={s.eventMonth}>{e.month}</Text>
              <Text style={s.eventDay}>{e.day}</Text>
            </View>
            <View style={s.eventInfo}>
              <Text style={s.eventTitle}>{e.title}</Text>
              <Text style={s.eventVenue}>📍 {e.venue} · {e.time}</Text>
              <View style={s.eventFooter}>
                <View style={[s.badge, { backgroundColor: e.bg }]}>
                  <Text style={[s.badgeText, { color: e.color }]}>{e.category}</Text>
                </View>
                <Text style={s.attending}>+{e.attending} attending</Text>
              </View>
            </View>
            <TouchableOpacity style={s.rsvpBtn}>
              <Text style={s.rsvpText}>RSVP</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        <View style={{ height: 20 }} />
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
  filterBtn: {
    backgroundColor: '#1c1c2e',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterText: { fontSize: 12, color: 'rgba(240,240,255,0.5)' },
  datePill: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  datePillActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.35)',
  },
  dateDay: { fontSize: 10, color: 'rgba(240,240,255,0.35)', marginBottom: 2 },
  dateNum: { fontSize: 16, fontWeight: '600', color: 'rgba(240,240,255,0.6)' },
  dateNumActive: { color: '#a78bfa' },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '500', color: 'rgba(240,240,255,0.4)' },
  eventCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  eventDate: {
    alignItems: 'center',
    width: 36,
    flexShrink: 0,
  },
  eventMonth: {
    fontSize: 9,
    color: 'rgba(240,240,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventDay: { fontSize: 22, fontWeight: '700', color: '#f0f0ff', lineHeight: 26 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: '600', color: '#f0f0ff', marginBottom: 3 },
  eventVenue: { fontSize: 11, color: 'rgba(240,240,255,0.35)', marginBottom: 8 },
  eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '500' },
  attending: { fontSize: 10, color: 'rgba(240,240,255,0.3)' },
  rsvpBtn: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  rsvpText: { fontSize: 11, color: '#a78bfa', fontWeight: '600' },
})