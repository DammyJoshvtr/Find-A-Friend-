import TopUserCard from "@/components/TopUserCard";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StudentCard from "../../components/discover/StudentCard";
import NeuralBackground from "../../components/NeuralBackground";
import ScreenLoader from "../../components/ScreenLoader";
import type { ConnectionStatus } from "../../lib/discoverLikes";
import {
  getConnectionStatusesBulk,
  getLikesCounts,
} from "../../lib/discoverLikes";
import type { TrendingHashtag } from "../../lib/feed";
import { getTrending } from "../../lib/feed";
import type { FollowProfile } from "../../lib/follows";
import { getMostFollowedUsers, getSuggestedUsers } from "../../lib/follows";
import { supabase } from "../../lib/supabase";
import { showTabBar } from "../../lib/tabBarAnim";
import { useTheme } from "../../lib/theme";
import { typography } from "../../lib/typography";
import { useBadgesStore } from "../../store/badgesStore";

export default function DiscoverScreen() {
  const [deck, setDeck] = useState<FollowProfile[]>([]);
  const [liked, setLiked] = useState(0);
  const [trending, setTrending] = useState<TrendingHashtag[]>([]);
  const [topFollowed, setTopFollowed] = useState<FollowProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [likesCount, setLikesCount] = useState({ received: 0, mutual: 0 });
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>(
    {},
  );
  const [userProfile, setUserProfile] = useState<FollowProfile | null>(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "All" | "Same Major" | "Hobbies" | "Newbies"
  >("All");

  const theme = useTheme();
  const markSeen = useBadgesStore((s) => s.markSeen);

  const scrollX = new Animated.Value(0);

  // Set to true to work completely offline with instant previews
  const USE_MOCK = false;

  // Dummy profiles for testing
  const MOCK_SUGGESTED_USERS = [
    {
      id: "1",
      full_name: "Joshua Damilola",
      department: "Computer Science",
      level: "400 Level",
      avatar_url:
        "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200",
      follower_count: 420,
      following_count: 120,
      interests: ["Coding", "Gaming", "Music"],
    },
    {
      id: "2",
      full_name: "Sarah Jenkins",
      department: "Biochemistry",
      level: "200 Level",
      avatar_url:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
      follower_count: 310,
      following_count: 240,
      interests: ["Reading", "Cooking", "Anime"],
    },
    {
      id: "3",
      full_name: "Tunde Bakare",
      department: "Mechanical Engineering",
      level: "500 Level",
      avatar_url: "", // Testing fallback initials
      follower_count: 180,
      following_count: 90,
      interests: ["Robotics", "Chess", "Fitness"],
    },
  ];

  const MOCK_TRENDING_HASHTAGS = [
    { hashtag_id: "t1", hashtags: { tag: "exam_week" }, post_count: 142 },
    { hashtag_id: "t2", hashtags: { tag: "hackathon" }, post_count: 85 },
    { hashtag_id: "t3", hashtags: { tag: "freshers_party" }, post_count: 67 },
  ];

  const MOCK_TOP_INFLUENCERS = [
    {
      id: "top1",
      full_name: "Alex Rivera",
      department: "Business Admin",
      level: "300 Level",
      avatar_url:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
      follower_count: 1240,
      following_count: 300,
    },
    {
      id: "top2",
      full_name: "Emily Watson",
      department: "Medicine",
      level: "400 Level",
      avatar_url:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200",
      follower_count: 950,
      following_count: 180,
    },
    {
      id: "top3",
      full_name: "David Kim",
      department: "Architecture",
      level: "300 Level",
      avatar_url: "",
      follower_count: 840,
      following_count: 420,
    },
  ];

  useFocusEffect(
    useCallback(() => {
      markSeen("discover");
    }, [markSeen]),
  );

  useEffect(() => {
    loadData();
    getLikesCounts().then(setLikesCount);

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setUserProfile(data);
        });
    });
  }, []);

  useEffect(() => {
    const followsChannel = supabase
      .channel("follows-realtime-discover")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newFollow = payload.new;
            const targetId = newFollow.following_id;
            setDeck((prev) =>
              prev.map((u) =>
                u.id === targetId
                  ? { ...u, follower_count: (u.follower_count ?? 0) + 1 }
                  : u,
              ),
            );
            setTopFollowed((prev) =>
              prev.map((u) =>
                u.id === targetId
                  ? { ...u, follower_count: (u.follower_count ?? 0) + 1 }
                  : u,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const oldFollow = payload.old;
            const targetId = oldFollow.following_id;
            setDeck((prev) =>
              prev.map((u) =>
                u.id === targetId
                  ? {
                      ...u,
                      follower_count: Math.max(0, (u.follower_count ?? 0) - 1),
                    }
                  : u,
              ),
            );
            setTopFollowed((prev) =>
              prev.map((u) =>
                u.id === targetId
                  ? {
                      ...u,
                      follower_count: Math.max(0, (u.follower_count ?? 0) - 1),
                    }
                  : u,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(followsChannel);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);

    if (USE_MOCK) {
      // Simulate a tiny 300ms network delay for realism, then load local data
      await new Promise((resolve) => setTimeout(resolve, 300));
      setDeck(MOCK_SUGGESTED_USERS);
      // setTrending(MOCK_TRENDING_HASHTAGS);
      setTopFollowed(MOCK_TOP_INFLUENCERS);
      setStatuses({
        "1": "none",
        "2": "requested_sent",
        "3": "none",
      });
      setLoading(false);
      return;
    }

    try {
      const [usersRes, trendingRes, topRes] = await Promise.all([
        getSuggestedUsers(),
        getTrending(),
        getMostFollowedUsers(),
      ]);
      const usersList = usersRes.data ?? [];
      setDeck(usersList);
      setTrending(trendingRes.data ?? []);
      setTopFollowed(topRes.data ?? []);

      const allUserIds = [
        ...usersList.map((u) => u.id),
        ...(topRes.data ?? []).map((u) => u.id),
      ];

      if (allUserIds.length > 0) {
        const statusesMap = await getConnectionStatusesBulk(allUserIds);
        setStatuses(statusesMap);
      } else {
        setStatuses({});
      }
    } catch (e) {
      console.warn("[Discover] loadData error:", e);
      setDeck([]);
      setStatuses({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      showTabBar();
    }
  }, [loading]);

  const handleConnectToggle = (userId: string, isConnecting: boolean) => {
    if (isConnecting) {
      setLiked((n) => n + 1);
      setStatuses((prev) => {
        const prevStatus = prev[userId];
        const nextStatus =
          prevStatus === "requested_received" ? "connected" : "requested_sent";
        return { ...prev, [userId]: nextStatus };
      });
    } else {
      setLiked((n) => Math.max(0, n - 1));
      setStatuses((prev) => ({ ...prev, [userId]: "none" }));
    }
    getLikesCounts().then(setLikesCount);
  };

  const handleReload = () => {
    setLiked(0);
    setSearchQuery("");
    setSelectedCategory("All");
    loadData();
  };

  // Filter and Search logic
  const getFilteredDeck = () => {
    let filtered = deck;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (u) =>
          (u.full_name && u.full_name.toLowerCase().includes(q)) ||
          (u.department && u.department.toLowerCase().includes(q)) ||
          (u.interests && u.interests.some((i) => i.toLowerCase().includes(q))),
      );
    }

    if (selectedCategory === "Same Major") {
      if (userProfile?.department) {
        filtered = filtered.filter(
          (u) => u.department === userProfile.department,
        );
      } else {
        filtered = [];
      }
    } else if (selectedCategory === "Hobbies") {
      if (userProfile?.interests && userProfile.interests.length > 0) {
        const myInterests = userProfile.interests.map((i) => i.toLowerCase());
        filtered = filtered.filter(
          (u) =>
            u.interests &&
            u.interests.some((i) => myInterests.includes(i.toLowerCase())),
        );
      } else {
        filtered = filtered.filter(
          (u) => u.interests && u.interests.length > 0,
        );
      }
    } else if (selectedCategory === "Newbies") {
      filtered = filtered.filter(
        (u) =>
          u.level &&
          (u.level.toLowerCase().includes("freshman") ||
            u.level.toLowerCase().includes("first year") ||
            u.level.toLowerCase().includes("1st year") ||
            u.level.toLowerCase().includes("lvl")),
      );
    }

    return filtered;
  };

  const filteredDeck = getFilteredDeck();
  const remaining = filteredDeck.length;

  const categories = [
    { id: "All", label: "All Students", icon: "people-outline" },
    { id: "Same Major", label: "Same Major", icon: "school-outline" },
    { id: "Hobbies", label: "Mutual Hobbies", icon: "ribbon-outline" },
    { id: "Newbies", label: "Newbies", icon: "sparkles-outline" },
  ];

  return (
    <SafeAreaView
      style={[s.container, { backgroundColor: theme.bg }]}
      edges={["top"]}
    >
      <NeuralBackground intensity="light" />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: theme.text }]}>Discover</Text>
          <Text style={[s.subtitle, { color: theme.textFaint }]}>
            {liked > 0
              ? `${liked} connections made today`
              : remaining > 0
                ? `${remaining} students found`
                : "Find your people"}
          </Text>
        </View>
        <View style={s.headerBtns}>
          {/* Connections / Requests button */}
          <TouchableOpacity
            style={[
              s.headerBtn,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={() => router.push("/discover-likes" as any)}
          >
            <Ionicons
              name="person-add-outline"
              size={18}
              color={theme.accent}
            />
            {(likesCount.received > 0 || likesCount.mutual > 0) && (
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {likesCount.mutual > 0
                    ? likesCount.mutual
                    : likesCount.received}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.headerBtn,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={handleReload}
          >
            <Ionicons name="refresh-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View
        style={[
          s.searchBarContainer,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={[s.searchInput, { color: theme.text }]}
          placeholder="Search by name, major, or hobbies..."
          placeholderTextColor={theme.textFaint}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView>
        {/* Top 10 Most Followed Section */}
        {topFollowed.length > 0 && !searchQuery && (
          <View style={s.topFollowedSection}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>
              Top Influencers 🔥
            </Text>
            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.topFollowedRow}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: true },
              )}
              scrollEventThrottle={16}
              decelerationRate="fast"
              snapToInterval={210}
            >
              {topFollowed.map((item, index) => (
                <TopUserCard
                  key={item.id}
                  user={item}
                  index={index}
                  scrollX={scrollX}
                  initialStatus={statuses[item.id] || "none"}
                  onConnectToggle={handleConnectToggle}
                />
              ))}
            </Animated.ScrollView>
          </View>
        )}

        {/* Category Tabs */}
        <View style={{ height: 38 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.categoriesContainer}
          >
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    s.categoryPill,
                    isActive
                      ? {
                          backgroundColor: theme.accent,
                          borderColor: theme.accent,
                        }
                      : {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                        },
                  ]}
                  onPress={() => setSelectedCategory(cat.id as any)}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={13}
                    color={isActive ? "#fff" : theme.textMuted}
                  />
                  <Text
                    style={[
                      s.categoryText,
                      { color: isActive ? "#fff" : theme.text },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Trending chips */}
        {trending.length > 0 && selectedCategory === "All" && !searchQuery && (
          <View style={{ height: 42, marginTop: 4 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.trendRow}
            >
              {trending.slice(0, 10).map((item) => (
                <TouchableOpacity
                  key={item.hashtag_id}
                  style={[
                    s.trendPill,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.accentBorder,
                    },
                  ]}
                  onPress={() =>
                    router.push(`/hashtag/${item.hashtags?.tag}` as any)
                  }
                >
                  <Text style={[s.trendText, { color: theme.accent }]}>
                    #{item.hashtags?.tag}
                  </Text>
                  <Text
                    style={[
                      s.trendCount,
                      { color: theme.textFaint, backgroundColor: theme.card2 },
                    ]}
                  >
                    {item.post_count}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Student Directory Grid */}
        {loading ? (
          <View
            style={{
              height: 250,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ScreenLoader message="Loading campus directory..." />
          </View>
        ) : remaining === 0 ? (
          <View style={s.center}>
            <Text style={s.doneEmoji}>🔍</Text>
            <Text style={[s.emptyTitle, { color: theme.text }]}>
              No students found
            </Text>
            <Text style={[s.emptyText, { color: theme.textMuted }]}>
              {selectedCategory === "Same Major" && !userProfile?.department
                ? "Fill out your profile department to connect with classmates!"
                : selectedCategory === "Hobbies" &&
                    (!userProfile?.interests ||
                      userProfile.interests.length === 0)
                  ? "Add interests to your profile to find like-minded people!"
                  : "Try adjusting your search query or categories."}
            </Text>
            <TouchableOpacity
              style={[s.reloadBtn, { backgroundColor: theme.accent }]}
              onPress={handleReload}
            >
              <Text style={s.reloadBtnText}>Reset search</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              paddingHorizontal: 8,
              paddingBottom: 120,
            }}
          >
            {filteredDeck.map((item) => (
              <View key={item.id} style={{ width: "50%", padding: 6 }}>
                <StudentCard
                  user={item}
                  initialStatus={statuses[item.id] || "none"}
                  onConnectToggle={handleConnectToggle}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: { fontSize: 26, fontFamily: typography.fontBold },
  subtitle: { fontSize: 12, fontFamily: typography.fontRegular, marginTop: 2 },
  headerBtns: { flexDirection: "row", gap: 8, marginTop: 2 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 0.5,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: typography.fontRegular,
    padding: 0,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 8,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 32,
    borderWidth: 0.5,
  },
  categoryText: { fontSize: 11, fontFamily: typography.fontMedium },
  trendRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 0.5,
  },
  trendText: { fontSize: 11, fontFamily: typography.fontMedium },
  trendCount: {
    fontSize: 9,
    fontFamily: typography.fontRegular,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 132,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  doneEmoji: { fontSize: 54 },
  emptyTitle: {
    fontSize: 18,
    fontFamily: typography.fontSemiBold,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    textAlign: "center",
    lineHeight: 20,
  },
  reloadBtn: {
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 8,
  },
  reloadBtnText: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    color: "#fff",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#f472b6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: typography.fontBold,
    color: "#fff",
  },
  topFollowedRow: {
    gap: 5,
    paddingBottom: 10,
  },
  topFollowedSection: {
    paddingHorizontal: 12,
  },
  sectionTitle: {
    paddingHorizontal: 12,
    fontSize: 20,
    fontWeight: "bold",
  },
});
