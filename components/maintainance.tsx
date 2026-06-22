import { useRouter } from "expo-router";
import { ArrowLeft, ClockFading } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../lib/theme";

const ComingSoon = () => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const theme = useTheme();

  const router = useRouter();

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -15,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <Animated.View
        style={[
          s.iconContainer,
          {
            transform: [{ translateY: floatAnim }, { scale: pulseAnim }],
          },
        ]}
      >
        <ClockFading size={90} color="#6366F1" strokeWidth={1.8} />
      </Animated.View>

      <Text style={[s.title, { color: theme.text }]}>Coming Soon</Text>

      <Text style={[s.description, { color: theme.textMuted }]}>
        We're working hard to bring this feature to life. Stay tuned for
        updates.
      </Text>

      <TouchableOpacity
        style={[
          s.goBackContainer,
          {
            backgroundColor: theme.bg || "#6366F1",
          },
        ]}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/");
          }
        }}
        activeOpacity={0.8}
      >
        <ArrowLeft size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={s.goBack}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ComingSoon;

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 320,
  },
  goBack: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },

  goBackContainer: {
    marginTop: 24,
    height: 44,
    minWidth: 120,
    borderRadius: 22,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
});
