import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { GAME_META, type GameType } from "../../lib/games";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { typography } from "../../lib/typography";

export function ChallengeBubble({
  challenge,
  mine,
  convId,
  myId,
  otherUserId,
  otherName,
}: {
  challenge: { gameType: string; emoji: string; label: string };
  mine: boolean;
  convId: string;
  myId: string;
  otherUserId: string;
  otherName: string;
}) {
  const theme = useTheme();
  const meta = GAME_META[challenge.gameType as GameType];

  const handleAccept = async () => {
    const gameType = challenge.gameType as GameType;

    // Navigate to waiting room first
    router.push({
      pathname: "/play/waiting",
      params: {
        gameType,
        opponentId: otherUserId,
        opponentName: otherName,
      },
    } as any);

    // Send acceptance message
    await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: myId,
      body: JSON.stringify({
        _type: "challenge_accepted",
        gameType: challenge.gameType,
        emoji: challenge.emoji,
        label: challenge.label,
        sessionId: "", // Will be matched by opponentId in waiting room
      }),
    });
  };

  const handleDecline = async () => {
    await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: myId,
      body: `❌ Declined the ${challenge.emoji} ${challenge.label} challenge.`,
    });
  };

  return (
    <View
      style={[
        cb.card,
        {
          backgroundColor: meta?.bg ?? "rgba(167,139,250,0.1)",
          borderColor: meta?.border ?? "rgba(167,139,250,0.3)",
        },
      ]}
    >
      <Text style={cb.emoji}>{challenge.emoji}</Text>
      <Text style={[cb.tag, { color: theme.textFaint }]}>GAME CHALLENGE</Text>
      <Text style={[cb.label, { color: meta?.color ?? theme.accent }]}>
        {challenge.label}
      </Text>
      {mine ? (
        <Text style={[cb.waiting, { color: theme.textFaint }]}>
          Waiting for response…
        </Text>
      ) : (
        <View style={cb.btns}>
          <TouchableOpacity style={cb.declineBtn} onPress={handleDecline}>
            <Text style={cb.declineText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              cb.acceptBtn,
              { backgroundColor: meta?.color ?? theme.accent },
            ]}
            onPress={handleAccept}
          >
            <Text style={cb.acceptText}>Accept ⚡</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const cb = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
    minWidth: 210,
  },
  emoji: { fontSize: 44, marginBottom: 2 },
  tag: { fontSize: 10, fontFamily: typography.fontMedium, letterSpacing: 1 },
  label: { fontSize: 17, fontFamily: typography.fontBold, marginBottom: 2 },
  waiting: { fontSize: 12, fontFamily: typography.fontRegular, marginTop: 8 },
  btns: { flexDirection: "row", gap: 10, marginTop: 12 },
  declineBtn: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.5)",
  },
  declineText: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    color: "#f87171",
  },
  acceptBtn: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9 },
  acceptText: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    color: "#fff",
  },
});
