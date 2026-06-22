/**
 * components/clubs/ClubCard.tsx
 * Club card with join/joined toggle.
 */
import { useTheme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Club } from "../../lib/clubs";
import { joinClub, leaveClub } from "../../lib/clubs";

interface ClubCardProps {
  club: Club;
  compact?: boolean;
}

export default function ClubCard({ club, compact }: ClubCardProps) {
  const [isMember, setIsMember] = useState(club.is_member ?? false);
  const [memberCount, setMemberCount] = useState(club.member_count);
  const [loading, setLoading] = useState(false);

  const theme = useTheme();

  const handleJoin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    if (isMember) {
      setIsMember(false);
      setMemberCount((c) => Math.max(0, c - 1));
      const { error } = await leaveClub(club.id);
      if (error) {
        setIsMember(true);
        setMemberCount((c) => c + 1);
      }
    } else {
      setIsMember(true);
      setMemberCount((c) => c + 1);
      const { error } = await joinClub(club.id);
      if (error) {
        setIsMember(false);
        setMemberCount((c) => Math.max(0, c - 1));
      }
    }
    setLoading(false);
  };

  const handlePress = () => {
    router.push(`/club/${club.id}` as any);
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[
          { backgroundColor: theme.card, borderColor: theme.border, borderRadius: 14 },
          theme.cardShadow,
          { marginRight: 10, borderWidth: 0.5 }
        ]}
        onPress={handlePress}
      >
        <View style={{ borderRadius: 14, overflow: "hidden", width: 110 }}>
          {club.cover_url ? (
            <Image
              source={{ uri: club.cover_url }}
              style={s.compactCover}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                s.compactCover,
                s.compactCoverPlaceholder,
                { backgroundColor: club.color + "22" },
              ]}
            >
              <Ionicons name="people" size={20} color={club.color || "#a78bfa"} />
            </View>
          )}
          <Text style={[s.compactName, { color: theme.text }]} numberOfLines={1}>
            {club.name}
          </Text>
          <Text style={[s.compactMembers, { color: theme.textMuted }]}>
            {memberCount} members
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        { backgroundColor: theme.card, borderColor: theme.border, borderRadius: 16 },
        theme.cardShadow,
        { borderWidth: 0.5 }
      ]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <View style={{ borderRadius: 16, overflow: "hidden" }}>
        {club.cover_url ? (
          <Image
            source={{ uri: club.cover_url }}
            style={s.cover}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              s.cover,
              s.coverPlaceholder,
              { backgroundColor: club.color + "22" },
            ]}
          >
            <Ionicons
              name="people-outline"
              size={28}
              color={club.color || "#a78bfa"}
            />
          </View>
        )}

        <View style={s.body}>
          <View style={{ flex: 1 }}>
            <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>
              {club.name}
            </Text>
            <Text style={[s.category, { color: theme.textMuted }]}>
              {club.category}
            </Text>
            <Text style={[s.members, { color: theme.textMuted }]}>
              {memberCount} members
            </Text>
          </View>

          <TouchableOpacity
            style={[s.joinBtn, isMember && s.joinedBtn]}
            onPress={handleJoin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={isMember ? "#a78bfa" : "#fff"}
              />
            ) : (
              <Text style={[s.joinText, isMember && s.joinedText]}>
                {isMember ? "Joined" : "Join"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 0.5,
  },
  cover: { width: "100%", height: 100 },
  coverPlaceholder: { alignItems: "center", justifyContent: "center" },
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },
  name: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  category: { fontSize: 10, marginBottom: 2 },
  members: { fontSize: 11 },
  joinBtn: {
    backgroundColor: "#a78bfa",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: "center",
  },
  joinedBtn: {
    backgroundColor: "rgba(167,139,250,0.12)",
    borderWidth: 0.5,
    borderColor: "rgba(167,139,250,0.4)",
  },
  joinText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  joinedText: { color: "#a78bfa" },
  // Compact
  compactCard: {
    width: 110,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 0.5,
    marginRight: 10,
  },
  compactCover: { width: "100%", height: 70 },
  compactCoverPlaceholder: { alignItems: "center", justifyContent: "center" },
  compactName: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  compactMembers: {
    fontSize: 9,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
});
