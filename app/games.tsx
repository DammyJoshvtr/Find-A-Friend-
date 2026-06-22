import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NeuralBackground from "../components/NeuralBackground";
import ScreenLoader from "../components/ScreenLoader";
import {
  GAME_META,
  getLeaderboard,
  getMyStats,
  type GameType,
  type LeaderboardEntry,
  type UserGameStats,
} from "../lib/games";
import { getInitials } from "../lib/matching";
import { useTheme } from "../lib/theme";
import { typography } from "../lib/typography";
import { useTabBarScroll } from "../lib/useTabBarScroll";
import { useBadgesStore } from "../store/badgesStore";

const GAME_TYPES: GameType[] = ["pool", "trivia", "wordle"];
const MEDALS = ["🥇", "🥈", "🥉"];

function Avatar({
  url,
  name,
  size,
  theme,
}: {
  url: string | null;
  name: string | null;
  size: number;
  theme: any;
}) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.card2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: size * 0.36,
          color: theme.accent,
          fontFamily: typography.fontBold,
        }}
      >
        {getInitials(name ?? "?")}
      </Text>
    </View>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text
        style={{ fontSize: 22, fontFamily: typography.fontExtraBold, color }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11,
          fontFamily: typography.fontRegular,
          color: theme.textMuted,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function GamesScreen() {
  const theme = useTheme();
  const { onScroll, scrollEventThrottle } = useTabBarScroll();
  const [stats, setStats] = useState<UserGameStats[]>([]);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [activeGame, setActiveGame] = useState<GameType>("pool");
  const [loading, setLoading] = useState(true);
  const [lbLoading, setLbLoading] = useState(false);
  const markSeen = useBadgesStore((s) => s.markSeen);

  useFocusEffect(
    React.useCallback(() => {
      markSeen("games");
    }, [markSeen]),
  );

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const { data } = await getMyStats();
      setStats(data ?? []);
      await switchGame("pool");
    } catch {
      // Non-fatal — show demo data
    } finally {
      setLoading(false);
    }
  };

  const switchGame = async (gt: GameType) => {
    setActiveGame(gt);
    setLbLoading(true);
    try {
      const { data } = await getLeaderboard(gt, 5);
      setLeaders(data && data.length > 0 ? data : []);
    } catch {
      setLeaders([]);
    } finally {
      setLbLoading(false);
    }
  };

  const statFor = (gt: GameType) =>
    stats.find((s) => s.game_type === gt) ?? {
      wins: 0,
      losses: 0,
      games_played: 0,
      game_type: gt,
    };

  const totalWins = stats.reduce((n, s) => n + s.wins, 0);
  const totalPlayed = stats.reduce((n, s) => n + s.games_played, 0);
  const winRate =
    totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : 0;

  return (
    <SafeAreaView
      style={[s.container, { backgroundColor: theme.bg }]}
      edges={["top"]}
    >
      <NeuralBackground intensity="light" />
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: theme.text }]}>Games</Text>
            <Text style={[s.subtitle, { color: theme.textFaint }]}>
              Challenge your campus
            </Text>
          </View>
          <TouchableOpacity
            style={[
              s.iconBtn,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={() => router.push(`/leaderboard/${activeGame}` as any)}
          >
            <Ionicons name="trophy-outline" size={18} color="#fbbf24" />
          </TouchableOpacity>
        </View>

        {/* Stats banner */}
        <View
          style={[
            s.banner,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <StatPill label="Total Wins" value={totalWins} color="#fbbf24" />
          <View style={[s.sep, { backgroundColor: theme.border }]} />
          <StatPill
            label="Games Played"
            value={totalPlayed}
            color={theme.accent}
          />
          <View style={[s.sep, { backgroundColor: theme.border }]} />
          <StatPill label="Win Rate" value={`${winRate}%`} color="#34d399" />
        </View>

        {/* Game cards */}
        <Text style={[s.sectionLabel, { color: theme.text }]}>
          Choose a Game
        </Text>

        {loading ? (
          <ScreenLoader message="Loading games..." />
        ) : (
          GAME_TYPES.map((gt) => {
            const meta = GAME_META[gt];
            const stat = statFor(gt);
            return (
              <TouchableOpacity
                key={gt}
                style={[
                  s.gameCard,
                  { backgroundColor: theme.card, borderColor: meta.border },
                ]}
                activeOpacity={0.8}
                onPress={() => router.push(`/game-lobby/${gt}` as any)}
              >
                {/* Colored icon box */}
                <View style={[s.gameIcon, { backgroundColor: meta.bg }]}>
                  <Text style={s.gameEmoji}>{meta.emoji}</Text>
                </View>

                {/* Info */}
                <View style={s.gameInfo}>
                  <Text style={[s.gameLabel, { color: theme.text }]}>
                    {meta.label}
                  </Text>
                  <Text style={[s.gameTagline, { color: theme.textMuted }]}>
                    {meta.tagline}
                  </Text>
                  <View style={s.gameRecord}>
                    <Text style={[s.recordWin, { color: meta.color }]}>
                      {stat.wins}W
                    </Text>
                    <Text style={[s.recordSep, { color: theme.textFaint }]}>
                      {" "}
                      ·{" "}
                    </Text>
                    <Text style={[s.recordLoss, { color: theme.textMuted }]}>
                      {stat.losses}L
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={s.gameActions}>
                  <View
                    style={[
                      s.playBtn,
                      { backgroundColor: meta.bg, borderColor: meta.border },
                    ]}
                  >
                    <Text style={[s.playBtnText, { color: meta.color }]}>
                      Play
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push(`/leaderboard/${gt}` as any)}
                    style={s.boardLink}
                  >
                    <Text style={[s.boardLinkText, { color: theme.textFaint }]}>
                      Board
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={10}
                      color={theme.textFaint}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Leaderboard preview */}
        <View style={s.lbHeaderRow}>
          <Text
            style={[s.sectionLabel, { color: theme.text, marginBottom: 0 }]}
          >
            🏆 Leaderboard
          </Text>
          <TouchableOpacity
            onPress={() => router.push(`/leaderboard/${activeGame}` as any)}
          >
            <Text style={[s.seeAll, { color: theme.accent }]}>See all →</Text>
          </TouchableOpacity>
        </View>

        {/* Game type tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabs}
        >
          {GAME_TYPES.map((gt) => (
            <TouchableOpacity
              key={gt}
              onPress={() => switchGame(gt)}
              style={[
                s.tab,
                {
                  backgroundColor:
                    activeGame === gt ? theme.accent : theme.card,
                  borderColor: activeGame === gt ? theme.accent : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  s.tabText,
                  { color: activeGame === gt ? "#fff" : theme.textMuted },
                ]}
              >
                {GAME_META[gt].emoji} {GAME_META[gt].label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Leader rows */}
        {lbLoading ? (
          <ActivityIndicator
            color={theme.accent}
            style={{ marginVertical: 20 }}
          />
        ) : leaders.length === 0 ? (
          <View
            style={[
              s.lbCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={{ padding: 24, alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 32 }}>🏆</Text>
              <Text
                style={[
                  s.lbName,
                  { color: theme.textMuted, textAlign: "center" },
                ]}
              >
                No games played yet
              </Text>
              <Text
                style={[
                  s.lbSub,
                  { color: theme.textFaint, textAlign: "center" },
                ]}
              >
                Be the first to play and claim the top spot!
              </Text>
            </View>
          </View>
        ) : (
          <View
            style={[
              s.lbCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            {leaders.map((entry, i) => (
              <View key={entry.user_id}>
                <View style={s.lbRow}>
                  <Text style={[s.medal, { color: theme.text }]}>{i < 3 ? MEDALS[i] : `${i + 1}.`}</Text>
                  <Avatar
                    url={entry.avatar_url}
                    name={entry.full_name}
                    size={36}
                    theme={theme}
                  />
                  <View style={s.lbMeta}>
                    <Text
                      style={[s.lbName, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {entry.full_name ?? "Player"}
                    </Text>
                    <Text style={[s.lbSub, { color: theme.textFaint }]}>
                      {entry.games_played} games · {entry.win_rate}% win rate
                    </Text>
                  </View>
                  <View style={s.winBadge}>
                    <Text style={s.winBadgeText}>{entry.wins}W</Text>
                  </View>
                </View>
                {i < leaders.length - 1 && (
                  <View style={[s.rowDiv, { backgroundColor: theme.border }]} />
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 24, fontFamily: typography.fontBold },
  subtitle: { fontSize: 12, fontFamily: typography.fontRegular, marginTop: 1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    paddingVertical: 20,
    borderWidth: 0.5,
    marginBottom: 24,
  },
  sep: { width: StyleSheet.hairlineWidth, height: 36 },

  sectionLabel: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    marginBottom: 12,
  },

  gameCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  gameIcon: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  gameEmoji: { fontSize: 30 },
  gameInfo: { flex: 1 },
  gameLabel: { fontSize: 15, fontFamily: typography.fontSemiBold },
  gameTagline: {
    fontSize: 11,
    fontFamily: typography.fontRegular,
    marginTop: 2,
  },
  gameRecord: { flexDirection: "row", marginTop: 6, alignItems: "center" },
  recordWin: { fontSize: 12, fontFamily: typography.fontBold },
  recordSep: { fontSize: 12 },
  recordLoss: { fontSize: 12, fontFamily: typography.fontMedium },
  gameActions: { alignItems: "center", gap: 6 },
  playBtn: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  playBtnText: { fontSize: 13, fontFamily: typography.fontSemiBold },
  boardLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  boardLinkText: { fontSize: 10, fontFamily: typography.fontRegular },

  lbHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, fontFamily: typography.fontMedium },

  tabs: { gap: 8, paddingBottom: 12 },
  tab: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  tabText: { fontSize: 12, fontFamily: typography.fontMedium },

  lbCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  medal: { fontSize: 20, width: 30, textAlign: "center" },
  lbMeta: { flex: 1 },
  lbName: { fontSize: 14, fontFamily: typography.fontMedium },
  lbSub: { fontSize: 11, fontFamily: typography.fontRegular, marginTop: 1 },
  winBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(251,191,36,0.1)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
  },
  winBadgeText: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    color: "#fbbf24",
  },
  rowDiv: { height: StyleSheet.hairlineWidth, marginLeft: 70 },
});
