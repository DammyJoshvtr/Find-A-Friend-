import { ConnectionStatus, likeUser, unlikeUser } from "@/lib/discoverLikes";
import { FollowProfile, followUser, unfollowUser } from "@/lib/follows";
import { client } from "@/lib/aws";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getInitials } from "../lib/matching";
import { useTheme } from "../lib/theme";
import { typography } from "../lib/typography";

import { supabase } from "../lib/supabase";

interface TopUserCardProps {
  user: FollowProfile;
  index: number;
  scrollX: Animated.Value;
  initialStatus?: ConnectionStatus;
  onConnectToggle?: (userId: string, isConnecting: boolean) => void;
}

export default function TopUserCard({
  user,
  index,
  scrollX,
  initialStatus = "none",
  onConnectToggle,
}: TopUserCardProps) {
  const theme = useTheme();
  const ITEM_SIZE = 220;

  const [status, setStatus] = useState<ConnectionStatus>("none");
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(user.follower_count);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setFollowerCount(user.follower_count);
  }, [user.follower_count]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }: any) => {
      if (authUser) setCurrentUserId(authUser.id);
    });
  }, []);

  const handleConnect = async () => {
    if (currentUserId === user.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);

    try {
      if (status === "connected") {
        Alert.alert(
          "Disconnect",
          `Are you sure you want to disconnect from ${user.full_name ?? "this student"}?`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setLoading(false),
            },
            {
              text: "Disconnect",
              style: "destructive",
              onPress: async () => {
                setLoading(true);
                try {
                  setStatus("none");
                  setFollowerCount((c) => Math.max(0, c - 1));
                  await unlikeUser(user.id);
                  const { error } = await unfollowUser(user.id);
                  if (error) {
                    setStatus("connected");
                    setFollowerCount((c) => c + 1);
                  } else if (onConnectToggle) {
                    onConnectToggle(user.id, false);
                  }
                } catch (e) {
                  console.warn(e);
                  setStatus("connected");
                  setFollowerCount((c) => c + 1);
                } finally {
                  setLoading(false);
                }
              },
            },
          ],
        );
        return;
      } else if (status === "requested_sent") {
        setStatus("none");
        setFollowerCount((c) => Math.max(0, c - 1));
        await unlikeUser(user.id);
        const { error } = await unfollowUser(user.id);
        if (error) {
          setStatus("requested_sent");
          setFollowerCount((c) => c + 1);
        } else if (onConnectToggle) {
          onConnectToggle(user.id, false);
        }
      } else if (status === "requested_received") {
        setStatus("connected");
        setFollowerCount((c) => c + 1);
        await likeUser(user.id);
        const { error } = await followUser(user.id);
        if (error) {
          setStatus("requested_received");
          setFollowerCount((c) => Math.max(0, c - 1));
        } else if (onConnectToggle) {
          onConnectToggle(user.id, true);
        }
      } else {
        setStatus("requested_sent");
        setFollowerCount((c) => c + 1);
        await likeUser(user.id);
        const { error } = await followUser(user.id);
        if (error) {
          setStatus("none");
          setFollowerCount((c) => Math.max(0, c - 1));
        } else if (onConnectToggle) {
          onConnectToggle(user.id, true);
        }
      }
    } catch (e) {
      console.warn("[TopUserCard] connection error:", e);
    } finally {
      setLoading(false);
    }
  };

  const inputRange = [
    (index - 1) * ITEM_SIZE,
    index * ITEM_SIZE,
    (index + 1) * ITEM_SIZE,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.85, 1, 0.85],
    extrapolate: "clamp",
  });

  const isPendingOrConnected =
    status === "connected" || status === "requested_sent";

  const buttonStyle = [
    styles.connectButton,
    isPendingOrConnected
      ? {
          backgroundColor: theme.accentBg,
          borderWidth: 0.5,
          borderColor: theme.accentBorder,
        }
      : { backgroundColor: theme.accent },
  ];

  const buttonTextStyle = [
    styles.connectButtonText,
    isPendingOrConnected && { color: theme.accent },
  ];

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push(`/profile/${user.id}` as any)}
    >
      <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
        {user.avatar_url ? (
          <Image
            source={{ uri: user.avatar_url }}
            style={styles.avatarImg}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flex: 1,
              backgroundColor: theme.card2,
            }}
          >
            <Text style={[styles.initials, { color: theme.accent }]}>
              {getInitials(user.full_name ?? "??")}
            </Text>
          </View>
        )}

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,1)"]}
          style={styles.gradient}
        />

        <View style={styles.detailsContainer}>
          <View style={styles.h}>
            <Text
              style={{ fontSize: 19, fontWeight: "bold", color: "white" }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {user.full_name}
            </Text>
          </View>

          <View style={styles.c}>
            <Text style={styles.d}>{user.department}</Text>
            <Text style={{ color: "white" }}>•</Text>
            <Text style={styles.d}>{user.level}</Text>
          </View>

          <View style={styles.c}>
            <Text style={styles.d}>Followers: {followerCount}</Text>
            <Text style={{ color: "white" }}>•</Text>
            <Text style={styles.d}>Following: {user.following_count}</Text>
          </View>

          {currentUserId !== user.id && (
            <TouchableOpacity
              style={buttonStyle}
              onPress={handleConnect}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={isPendingOrConnected ? theme.accent : "#fff"}
                />
              ) : (
                <Text style={buttonTextStyle}>
                  {status === "connected"
                    ? "Connected"
                    : status === "requested_sent"
                      ? "Requested"
                      : status === "requested_received"
                        ? "Accept 👋"
                        : "Connect 👋"}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    width: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 5,
    marginVertical: 10,
  },
  background: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: "#ffffff", // Placeholder color
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 100,
  },
  detailsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  d: {
    fontSize: 13,
    color: "white",
  },
  c: {
    display: "flex",
    flexDirection: "row",
    gap: 5,
  },
  connectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginVertical: 5,
    alignSelf: "flex-start",
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  connectButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  h: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  initials: {
    fontSize: 150,
    fontWeight: "bold",
    fontFamily: typography.fontBold,
  },
  avatarImg: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
});
