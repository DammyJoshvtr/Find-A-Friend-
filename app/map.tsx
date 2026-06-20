import ComingSoon from "@/components/maintainance";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import { router } from 'expo-router'
import { client } from '../lib/aws'
import { useTheme } from '../lib/theme'
import { getTimeAgo } from '../lib/matching'

const VENUES = [
  { name: "Engineering Hall", x: 0.25, y: 0.25, color: "#a78bfa" },
  { name: "Arts Centre", x: 0.65, y: 0.22, color: "#f472b6" },
  { name: "Sports Complex", x: 0.22, y: 0.62, color: "#34d399" },
  { name: "Library", x: 0.65, y: 0.58, color: "#60a5fa" },
  { name: "Student Union", x: 0.45, y: 0.75, color: "#fbbf24" },
  { name: "Medical Centre", x: 0.78, y: 0.8, color: "#f87171" },
];

export default function MapScreen() {
  const theme = useTheme();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [mapSize, setMapSize] = useState({ width: 300, height: 300 });

  const MAINTAINANCE = true;

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const { data } = await client.models.events.list({
        // TODO: gte, order, limit
      })
      setEvents(data ?? [])
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  };

  const getVenueEvents = (venueName: string) => {
    return events.filter((e) =>
      e.venue?.toLowerCase().includes(venueName.toLowerCase()),
    );
  };

  if (MAINTAINANCE) {
    return <ComingSoon />;
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={s.header}>
        <Text style={s.title}>Campus map</Text>
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>Live</Text>
        </View>
      </View>

      <View
        style={s.mapContainer}
        onLayout={(e) =>
          setMapSize({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          })
        }
      >
        <View style={s.mapGrid}>
          {[...Array(6)].map((_, i) => (
            <View
              key={`h${i}`}
              style={[s.gridLine, s.gridLineH, { top: `${(i + 1) * 14}%` }]}
            />
          ))}
          {[...Array(6)].map((_, i) => (
            <View
              key={`v${i}`}
              style={[s.gridLine, s.gridLineV, { left: `${(i + 1) * 14}%` }]}
            />
          ))}
        </View>

        {VENUES.map((venue, i) => {
          const venueEvents = getVenueEvents(venue.name);
          const hasEvents = venueEvents.length > 0;
          return (
            <TouchableOpacity
              key={i}
              style={[
                s.venuePin,
                {
                  left: `${venue.x * 100}%`,
                  top: `${venue.y * 100}%`,
                  borderColor: venue.color,
                },
                selectedVenue?.name === venue.name && s.venuePinSelected,
              ]}
              onPress={() =>
                setSelectedVenue(
                  selectedVenue?.name === venue.name ? null : venue,
                )
              }
            >
              <View style={[s.pinDot, { backgroundColor: venue.color }]} />
              {hasEvents && <View style={s.eventIndicator} />}
              <View
                style={[
                  s.pinLabel,
                  selectedVenue?.name === venue.name && {
                    backgroundColor: venue.color,
                  },
                ]}
              >
                <Text
                  style={[
                    s.pinText,
                    selectedVenue?.name === venue.name && { color: "#fff" },
                  ]}
                  numberOfLines={1}
                >
                  {venue.name.split(" ")[0]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={s.youPin}>
          <View style={s.youDot} />
          <Text style={s.youText}>You</Text>
        </View>
      </View>

      {selectedVenue && (
        <View style={[s.venueCard, { borderColor: selectedVenue.color }]}>
          <View style={s.venueCardHeader}>
            <View
              style={[s.venueCardDot, { backgroundColor: selectedVenue.color }]}
            />
            <Text style={s.venueCardName}>{selectedVenue.name}</Text>
          </View>
          {getVenueEvents(selectedVenue.name).length > 0 ? (
            getVenueEvents(selectedVenue.name).map((e: any, i: number) => (
              <View key={i} style={s.venueEvent}>
                <Text style={s.venueEventTitle}>{e.title}</Text>
                <Text style={s.venueEventTime}>
                  {new Date(e.starts_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            ))
          ) : (
            <Text style={s.venueEmpty}>No events scheduled here</Text>
          )}
        </View>
      )}

      <View style={s.section}>
        <Text style={s.sectionTitle}>Upcoming events</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#a78bfa" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={s.eventsList} showsVerticalScrollIndicator={false}>
          {events.length === 0 ? (
            <View style={s.emptyEvents}>
              <Text style={s.emptyIcon}>📅</Text>
              <Text style={s.emptyText}>No upcoming events yet</Text>
              <Text style={s.emptySubText}>
                Check back later or create an event!
              </Text>
            </View>
          ) : (
            events.map((e: any, i: number) => (
              <TouchableOpacity
                key={i}
                style={s.eventRow}
                onPress={() => router.push(`/event/${e.id}` as any)}
              >
                <View style={[s.eventDot, { backgroundColor: "#a78bfa" }]} />
                <View style={s.eventInfo}>
                  <Text style={s.eventTitle}>{e.title}</Text>
                  <Text style={s.eventVenue}>
                    📍 {e.venue} · {getTimeAgo(e.starts_at)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.rsvpBtn}
                  onPress={(ev) => {
                    ev.stopPropagation();
                    router.push(`/event/${e.id}` as any);
                  }}
                >
                  <Text style={s.rsvpText}>RSVP</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#f0f0ff" },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(52,211,153,0.12)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: "rgba(52,211,153,0.3)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#34d399" },
  liveText: { fontSize: 11, color: "#34d399", fontWeight: "500" },
  mapContainer: {
    height: 240,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#141420",
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  mapGrid: { position: "absolute", width: "100%", height: "100%" },
  gridLine: { position: "absolute", backgroundColor: "rgba(255,255,255,0.04)" },
  gridLineH: { width: "100%", height: 0.5 },
  gridLineV: { height: "100%", width: 0.5 },
  venuePin: {
    position: "absolute",
    alignItems: "center",
    transform: [{ translateX: -20 }, { translateY: -20 }],
    padding: 4,
  },
  venuePinSelected: {
    transform: [{ translateX: -20 }, { translateY: -20 }, { scale: 1.2 }],
  },
  pinDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 3 },
  eventIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fbbf24",
    position: "absolute",
    top: 2,
    right: 2,
  },
  pinLabel: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pinText: { fontSize: 8, color: "rgba(240,240,255,0.8)", fontWeight: "500" },
  youPin: {
    position: "absolute",
    left: "48%",
    top: "48%",
    alignItems: "center",
    transform: [{ translateX: -10 }, { translateY: -10 }],
  },
  youDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#60a5fa",
    borderWidth: 2,
    borderColor: "#fff",
  },
  youText: { fontSize: 8, color: "#60a5fa", fontWeight: "700", marginTop: 2 },
  venueCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: "#1c1c2e",
    borderRadius: 14,
    padding: 12,
    borderWidth: 0.5,
  },
  venueCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  venueCardDot: { width: 8, height: 8, borderRadius: 4 },
  venueCardName: { fontSize: 13, fontWeight: "600", color: "#f0f0ff" },
  venueEvent: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  venueEventTitle: { fontSize: 12, color: "rgba(240,240,255,0.7)" },
  venueEventTime: { fontSize: 11, color: "#a78bfa" },
  venueEmpty: {
    fontSize: 12,
    color: "rgba(240,240,255,0.3)",
    fontStyle: "italic",
  },
  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(240,240,255,0.5)",
  },
  eventsList: { flex: 1, paddingHorizontal: 16 },
  emptyEvents: {
    alignItems: "center",
    paddingTop: 20,
    gap: 8,
  },
  emptyIcon: { fontSize: 32 },
  emptyText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(240,240,255,0.4)",
  },
  emptySubText: { fontSize: 12, color: "rgba(240,240,255,0.25)" },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  eventDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  eventInfo: { flex: 1 },
  eventTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#f0f0ff",
    marginBottom: 2,
  },
  eventVenue: { fontSize: 11, color: "rgba(240,240,255,0.35)" },
  rsvpBtn: {
    backgroundColor: "rgba(167,139,250,0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: "rgba(167,139,250,0.3)",
  },
  rsvpText: { fontSize: 11, color: "#a78bfa", fontWeight: "600" },
});
