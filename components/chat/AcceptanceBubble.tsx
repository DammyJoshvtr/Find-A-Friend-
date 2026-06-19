import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../../lib/theme";
import { typography } from "../../lib/typography";

export function AcceptanceBubble({
  acceptance,
  otherUserId,
  otherName,
}: {
  acceptance: { gameType: string; emoji: string; label: string };
  otherUserId: string;
  otherName: string;
}) {
  const theme = useTheme();

  const handleJoin = () => {
    router.push({
      pathname: "/play/waiting",
      params: {
        gameType: acceptance.gameType,
        opponentId: otherUserId,
        opponentName: otherName,
      },
    } as any);
  };

  return (
    <View
      style={[
        ab.card,
        {
          backgroundColor: "rgba(74,222,128,0.08)",
          borderColor: "rgba(74,222,128,0.25)",
        },
      ]}
    >
      <View style={ab.top}>
        <Text style={ab.emoji}>{acceptance.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[ab.title, { color: theme.text }]}>
            Challenge Accepted!
          </Text>
          <Text style={[ab.sub, { color: theme.textFaint }]}>
            Let's play {acceptance.label}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[ab.btn, { backgroundColor: "#10b981" }]}
        onPress={handleJoin}
      >
        <Text style={ab.btnText}>Join Game ⚡</Text>
      </TouchableOpacity>
    </View>
  );
}

const ab = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    minWidth: 210,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  emoji: { fontSize: 34 },
  title: { fontSize: 14, fontFamily: typography.fontBold },
  sub: { fontSize: 11, fontFamily: typography.fontRegular },
  btn: { borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  btnText: { fontSize: 13, fontFamily: typography.fontBold, color: "#fff" },
});
