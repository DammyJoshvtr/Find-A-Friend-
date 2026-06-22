import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { router, useLocalSearchParams, useSegments } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from 'react-native-toast-message'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../lib/theme";
import { typography } from "../../lib/typography";

const { width } = Dimensions.get("window");

type Mode = 'signup' | 'signin' | 'forgot' | 'reset' | 'confirm'

const UNIVERSITY_DOMAINS = [
  "unilag.edu.ng",
  "ui.edu.ng",
  "oau.edu.ng",
  "unn.edu.ng",
  "abu.edu.ng",
  "uniben.edu.ng",
  "lasu.edu.ng",
  "yabatech.edu.ng",
  "edu.ng",
  "ac.uk",
  "edu",
  "ac.za",
];

function isUniversityEmail(email: string) {
  return UNIVERSITY_DOMAINS.some((d) => email.toLowerCase().endsWith(d));
}

function AnimatedInput({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  isPassword,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  isPassword?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderOp = useSharedValue(0);
  const labelOp = useSharedValue(0.45);

  useEffect(() => {
    borderOp.value = withTiming(focused ? 1 : 0, { duration: 220 });
    labelOp.value = withTiming(focused ? 0.9 : 0.45, { duration: 220 });
  }, [focused]);

  const borderStyle = useAnimatedStyle(() => ({ opacity: borderOp.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOp.value }));

  return (
    <View style={iv.wrap}>
      <Animated.Text style={[iv.label, { color: theme.accent }, labelStyle]}>
        {label}
      </Animated.Text>
      <View
        style={[
          iv.inputOuter,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <TextInput
          style={[
            iv.input,
            { color: theme.text },
            isPassword && { paddingRight: 50 },
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.textFaint}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword ? hidden : secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "none"}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {isPassword && (
          <TouchableOpacity
            style={iv.eyeBtn}
            onPress={() => setHidden(!hidden)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={hidden ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={theme.textMuted}
            />
          </TouchableOpacity>
        )}
        <Animated.View
          style={[iv.focusLine, { backgroundColor: theme.accent }, borderStyle]}
        />
      </View>
    </View>
  );
}

const iv = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: "#c4b5fd",
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  inputOuter: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(167,139,250,0.06)",
    borderWidth: 0.5,
    borderColor: "rgba(167,139,250,0.2)",
  },
  input: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: "#f0e8ff",
  },
  eyeBtn: {
    position: "absolute",
    right: 16,
    height: "100%",
    justifyContent: "center",
  },
  focusLine: {
    position: "absolute",
    bottom: 0,
    left: 12,
    right: 12,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "#a78bfa",
  },
});

function Orb({
  x,
  y,
  size,
  color,
  delay,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.2, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.3, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.7, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export default function VerifyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { initialMode } = useLocalSearchParams<{ initialMode?: Mode }>();
  const [mode, setMode] = useState<Mode>(initialMode === "signin" || initialMode === "signup" ? initialMode : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialMode === "signin" || initialMode === "signup") {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Entry animations
  const cardOp = useSharedValue(0);
  const cardY = useSharedValue(30);
  const tabSlide = useSharedValue(0);

  useEffect(() => {
    cardOp.value = withDelay(200, withTiming(1, { duration: 500 }));
    cardY.value = withDelay(
      200,
      withSpring(0, { damping: 16, stiffness: 100 }),
    );
  }, []);

  useEffect(() => {
    tabSlide.value = withSpring(mode === "signup" ? 0 : 1, {
      damping: 18,
      stiffness: 140,
    });
  }, [mode]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOp.value,
    transform: [{ translateY: cardY.value }],
  }));

  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabSlide.value * ((width - 48) / 2) }],
  }));

  const handleResendCode = async () => {
    const trimmedEmail = email.toLowerCase().trim()
    if (!trimmedEmail) {
      Toast.show({ type: 'error', text1: 'Missing email', text2: 'Please enter your university email' })
      return
    }
    setLoading(true)
    const { error } = await (supabase.auth as any).resendConfirmationCode(trimmedEmail)
    setLoading(false)
    if (error) {
      Toast.show({ type: 'error', text1: 'Resend failed', text2: error.message })
    } else {
      Toast.show({ type: 'success', text1: 'Code sent', text2: 'Please check your inbox' })
    }
  }

  const handleSubmit = async () => {
    const trimmedEmail = email.toLowerCase().trim();

    if (mode === 'forgot') {
      if (!trimmedEmail) {
        Toast.show({ type: 'error', text1: 'Missing email', text2: 'Please enter your university email' })
        return
      }
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail)
      setLoading(false)
      if (error) {
        Toast.show({ type: 'error', text1: 'Request failed', text2: error.message })
      } else {
        Toast.show({ type: 'success', text1: 'Code sent', text2: 'Check your email inbox' })
        setMode('reset')
      }
      return
    }

    if (mode === 'reset') {
      if (!trimmedEmail || !code || !password) {
        Toast.show({ type: 'error', text1: 'Missing fields', text2: 'Please fill in all fields' })
        return
      }
      if (password.length < 6) {
        Toast.show({ type: 'error', text1: 'Weak password', text2: 'Password must be at least 6 characters' })
        return
      }
      setLoading(true)
      const { error } = await (supabase.auth as any).updateUserPassword(trimmedEmail, code, password)
      setLoading(false)
      if (error) {
        Toast.show({ type: 'error', text1: 'Reset failed', text2: error.message })
      } else {
        Toast.show({ type: 'success', text1: 'Password reset successful', text2: 'You can now sign in' })
        setMode('signin')
        setPassword('')
        setCode('')
      }
      return
    }

    if (mode === 'confirm') {
      if (!trimmedEmail || !code) {
        Toast.show({ type: 'error', text1: 'Missing code', text2: 'Please enter the verification code' })
        return
      }
      setLoading(true)
      const { data: confirmData, error } = await (supabase.auth as any).confirmSignUp(trimmedEmail, code)
      setLoading(false)
      if (error) {
        Toast.show({ type: 'error', text1: 'Verification failed', text2: error.message })
      } else if (confirmData?.isReVerify) {
        // ── Re-verification path: user already has a profile ──
        // Upgrade their badge in the database to 'verified' now.
        try {
          const { data: profileRow } = await supabase
            .from('profiles').select('id').eq('email', trimmedEmail).maybeSingle()
          if (profileRow?.id) {
            await supabase
              .from('profiles')
              .update({ badge_type: 'verified', badge_color: '#a78bfa' })
              .eq('id', profileRow.id)
          }
        } catch (dbErr) {
          console.warn('Badge upgrade failed:', dbErr)
        }
        Toast.show({ type: 'success', text1: '✅ Email verified!', text2: 'Welcome back — signing you in.' })
        setCode('')
        // Sign them in so they get a fresh session with email_verified=true
        setMode('signin')
      } else {
        // ── New-user path: prompt to sign in ──
        Toast.show({ type: 'success', text1: '✅ Email verified!', text2: 'You can now sign in with your password.' })
        setMode('signin')
        setCode('')
        setPassword('')
      }
      return
    }

    if (!trimmedEmail || !password) {
      Toast.show({
        type: "error",
        text1: "Missing fields",
        text2: "Please fill in all fields",
      });
      return;
    }
    if (password.length < 6) {
      Toast.show({
        type: "error",
        text1: "Weak password",
        text2: "Password must be at least 6 characters",
      });
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      Toast.show({
        type: "error",
        text1: "Passwords do not match",
        text2: "Please check your passwords",
      });
      return;
    }

    setLoading(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { email: trimmedEmail } },
      });
      if (error) {
        setLoading(false);
        if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("userexists")) {
          Toast.show({
            type: "info",
            text1: "Account exists",
            text2: "Switching to sign in.",
          });
          setMode("signin");
        } else {
          Toast.show({
            type: "error",
            text1: "Sign up failed",
            text2: error.message,
          });
        }
        return;
      }
      setLoading(false)
      Toast.show({ type: 'success', text1: 'Verify your email', text2: `Enter the code sent to ${trimmedEmail}` })
      setMode('confirm')
      setCode('')
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      setLoading(false);
      if (error) {
        if (error.message.toLowerCase().includes('not confirmed') || error.message.includes('UserNotConfirmedException')) {
          Toast.show({ type: 'info', text1: '📧 Verify your email', text2: 'A verification code has been sent to your inbox.' })
          setMode('confirm')
          setCode('')
        } else if (error.message.toLowerCase().includes('invalid login credentials') || error.message.includes('NotAuthorizedException')) {
          Toast.show({ type: 'error', text1: 'Sign in failed', text2: 'Wrong email or password.' })
        } else {
          Toast.show({
            type: "error",
            text1: "Sign in error",
            text2: error.message,
          });
        }
        return;
      }
      if (data.session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.session.user.id)
          .maybeSingle();
        router.replace(profile ? "/(tabs)" : "/(auth)/onboarding");
      }
    }
  };

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      {/* Background */}
      <View style={[s.bg, { backgroundColor: theme.bg }]} />

      {/* Grid */}

      {/* Ambient orbs */}
      <Orb
        x={width * 0.1}
        y={120}
        size={200}
        color={theme.dark ? "rgba(167,139,250,0.09)" : "rgba(167,139,250,0.04)"}
        delay={0}
      />
      <Orb
        x={width * 0.9}
        y={300}
        size={160}
        color={theme.dark ? "rgba(96,165,250,0.07)" : "rgba(96,165,250,0.03)"}
        delay={800}
      />
      <Orb
        x={width * 0.5}
        y={600}
        size={220}
        color={theme.dark ? "rgba(244,114,182,0.06)" : "rgba(244,114,182,0.03)"}
        delay={1200}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
        >
          <ScrollView
            contentContainerStyle={[
              s.scroll,
              { paddingBottom: insets.bottom + 48 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back */}
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Text style={[s.backText, { color: theme.accent }]}>← Back</Text>
            </TouchableOpacity>

            {/* Logo */}
            <View style={s.logoRow}>
              <View
                style={[
                  s.logoWrap,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View
                  style={[s.logoGlow, { backgroundColor: theme.accentGlow }]}
                />
                <Text style={[s.logoText, { color: theme.accent }]}>FAF</Text>
                <View style={s.logoDot} />
              </View>
              <View>
                <Text style={[s.appName, { color: theme.text }]}>
                  Find A Friend
                </Text>
                <Text style={[s.appSub, { color: theme.textMuted }]}>
                  Campus social universe
                </Text>
              </View>
            </View>

            {/* Card */}
            <Animated.View
              style={[
                s.card,
                { backgroundColor: theme.card, borderColor: theme.border },
                cardStyle,
              ]}
            >
              {/* Tab switcher or Title Header */}
              {mode === 'signup' || mode === 'signin' ? (
                <View style={[s.tabBar, { borderColor: theme.border }]}>
                  <Animated.View
                    style={[
                      s.tabIndicator,
                      { backgroundColor: theme.accent },
                      tabIndicatorStyle,
                    ]}
                  />
                  <TouchableOpacity
                    style={s.tabBtn}
                    onPress={() => {
                      setMode("signup");
                      setPassword("");
                      setConfirmPassword("");
                    }}
                  >
                    <Text
                      style={[
                        s.tabLabel,
                        { color: theme.textMuted },
                        mode === "signup" && { color: theme.accent },
                      ]}
                    >
                      Sign Up
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.tabBtn}
                    onPress={() => {
                      setMode("signin");
                      setPassword("");
                      setConfirmPassword("");
                    }}
                  >
                    <Text
                      style={[
                        s.tabLabel,
                        { color: theme.textMuted },
                        mode === "signin" && { color: theme.accent },
                      ]}
                    >
                      Sign In
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[s.tabBarTitle, { borderColor: theme.border }]}>
                  <Text style={[s.tabBarTitleText, { color: theme.accent }]}>
                    {mode === 'forgot' && 'Reset Password'}
                    {mode === 'reset' && 'Set New Password'}
                    {mode === 'confirm' && 'Confirm Email'}
                  </Text>
                </View>
              )}

              <View style={s.cardBody}>
                <AnimatedInput
                  label="University Email"
                  placeholder="yourname@unilag.edu.ng"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />
                {(mode === 'reset' || mode === 'confirm') && (
                  <AnimatedInput
                    label="Verification Code"
                    placeholder="Enter 6-digit code"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                  />
                )}

                {mode !== 'forgot' && mode !== 'confirm' && (
                  <AnimatedInput
                    label={mode === 'reset' ? "New Password" : "Password"}
                    placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'}
                    value={password}
                    onChangeText={setPassword}
                    isPassword
                  />
                )}

                {(mode === 'signin' || mode === 'signup') && (
                  <TouchableOpacity
                    onPress={() => setMode('forgot')}
                    style={s.forgotBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.forgotText, { color: theme.accent }]}>Forgot password?</Text>
                  </TouchableOpacity>
                )}

                {mode === 'signup' && (
                  <AnimatedInput
                    label="Confirm Password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    isPassword
                  />
                )}


                {mode === "signup" && (
                  <View
                    style={[
                      s.infoCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View
                      style={[s.infoDot, { backgroundColor: theme.accent }]}
                    />
                    <Text style={[s.infoText, { color: theme.textMuted }]}>
                      University email required — verified students only
                    </Text>
                  </View>
                )}

                {mode === 'forgot' && (
                  <View style={[s.infoCard, { backgroundColor: 'rgba(96,165,250,0.08)', borderColor: 'rgba(96,165,250,0.2)' }]}>
                    <View style={[s.infoDot, { backgroundColor: '#60a5fa' }]} />
                    <Text style={[s.infoText, { color: 'rgba(96,165,250,0.8)' }]}>
                      We will send a password reset code to your university email.
                    </Text>
                  </View>
                )}

                {mode === 'confirm' && (
                  <View style={[s.infoCard, { backgroundColor: 'rgba(167,139,250,0.08)', borderColor: 'rgba(167,139,250,0.2)' }]}>
                    <View style={[s.infoDot, { backgroundColor: '#a78bfa' }]} />
                    <Text style={[s.infoText, { color: 'rgba(167,139,250,0.8)' }]}>
                      Please check your university email inbox for the 6-digit confirmation code.
                    </Text>
                  </View>
                )}

                {mode === 'confirm' && (
                  <TouchableOpacity
                    onPress={handleResendCode}
                    style={s.resendBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={s.resendText}>Didn't receive code? Resend Code</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    s.btnPrimary,
                    { backgroundColor: theme.accent },
                    loading && s.btnDisabled,
                  ]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <View style={s.btnGlow} />
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.btnText}>
                      {mode === 'signup' && 'Create Account →'}
                      {mode === 'signin' && 'Sign In →'}
                      {mode === 'forgot' && 'Send Reset Code →'}
                      {mode === 'reset' && 'Reset Password →'}
                      {mode === 'confirm' && 'Verify Email →'}
                    </Text>
                  )}
                </TouchableOpacity>

                {mode === 'signup' && (
                  <Text style={[s.termsText, { color: theme.textFaint }]}>
                    By continuing you agree to our{" "}
                    <Text style={[s.termsLink, { color: theme.accent }]}>
                      Terms
                    </Text>{" "}
                    and{" "}
                    <Text style={[s.termsLink, { color: theme.accent }]}>
                      Privacy Policy
                    </Text>
                  </Text>
                )}

                {(mode === 'forgot' || mode === 'reset' || mode === 'confirm') && (
                  <TouchableOpacity
                    onPress={() => { setMode('signin'); setPassword(''); setConfirmPassword(''); setCode('') }}
                    style={s.cancelBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.cancelText, { color: theme.textMuted }]}>← Back to Sign In</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#07070f" },

  grid: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(167,139,250,0.05)",
  },

  scroll: { paddingHorizontal: 20, paddingTop: 12 },

  backBtn: { marginBottom: 24, paddingVertical: 4 },
  backText: {
    fontSize: 14,
    fontFamily: typography.fontMedium,
    color: "#a78bfa",
  },

  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 32,
  },
  logoWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(167,139,250,0.08)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(167,139,250,0.12)",
    borderRadius: 16,
  },
  logoText: {
    fontSize: 17,
    fontFamily: typography.fontExtraBold,
    color: "#c4b5fd",
    letterSpacing: 1.5,
  },
  logoDot: {
    position: "absolute",
    bottom: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ade80",
  },
  appName: {
    fontSize: 18,
    fontFamily: typography.fontBold,
    color: "#f0e8ff",
  },
  appSub: {
    fontSize: 12,
    fontFamily: typography.fontRegular,
    color: "rgba(196,181,253,0.45)",
    marginTop: 2,
  },

  card: {
    borderRadius: 24,
    backgroundColor: "rgba(167,139,250,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(167,139,250,0.18)",
    overflow: "hidden",
  },

  tabBar: {
    flexDirection: "row",
    position: "relative",
    borderBottomWidth: 0.5,
    borderColor: "rgba(167,139,250,0.15)",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "50%",
    height: 2,
    borderRadius: 1,
    backgroundColor: "#a78bfa",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: "rgba(196,181,253,0.4)",
  },
  tabLabelActive: { color: "#c4b5fd" },

  cardBody: { padding: 20, gap: 0 },

  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(52,211,153,0.08)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5,
    borderColor: "rgba(52,211,153,0.2)",
    marginBottom: 16,
    marginTop: 4,
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34d399",
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: typography.fontRegular,
    color: "rgba(52,211,153,0.8)",
    lineHeight: 18,
  },

  btnPrimary: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#a78bfa",
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 14,
    shadowColor: "#a78bfa",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  btnDisabled: { opacity: 0.55 },
  btnGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  btnText: {
    fontSize: 15,
    fontFamily: typography.fontBold,
    color: "#fff",
    letterSpacing: 0.3,
  },

  termsText: {
    fontSize: 11,
    fontFamily: typography.fontRegular,
    color: "rgba(196,181,253,0.3)",
    textAlign: "center",
  },
  termsLink: { color: "rgba(167,139,250,0.6)" },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 16,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 12,
    fontFamily: typography.fontMedium,
  },
  tabBarTitle: {
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 0.5,
  },
  tabBarTitleText: {
    fontSize: 15,
    fontFamily: typography.fontBold,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 13,
    fontFamily: typography.fontMedium,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  resendText: {
    fontSize: 12,
    fontFamily: typography.fontMedium,
    textDecorationLine: 'underline',
  },
});
