/**
 * app/create-anonymous-post.tsx
 * Create an anonymous post with disclaimer checkbox.
 */
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAnonymousPost } from "../lib/anonymous";
import { useTheme } from "../lib/theme";

export default function CreateAnonPostScreen() {
  const theme = useTheme();
  const [body, setBody] = useState("");
  // const [agreed, setAgreed] = useState(false)
  const [posting, setPosting] = useState(false);

  const canPost = body.trim().length > 0 && !posting;

  const handlePost = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      const { error } = await createAnonymousPost(body.trim());
      if (error) throw error;
      DeviceEventEmitter.emit("refresh_anonymous_feed");
      router.back();
    } catch {
      Alert.alert("Error", "Could not post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView
      style={[s.container, { backgroundColor: theme.bg }]}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color="rgba(240,240,255,0.6)" />
          </TouchableOpacity>
          <Text style={s.title}>Post Anonymously</Text>
          <TouchableOpacity
            style={[s.postBtn, !canPost && s.postBtnDisabled]}
            onPress={handlePost}
            disabled={!canPost}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.postBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Ghost header */}
          <View style={s.anonHeader}>
            <View style={s.anonAvatar}>
              <Ionicons
                name="eye-off-outline"
                size={20}
                color="rgba(244,114,182,0.7)"
              />
            </View>
            <View>
              <Text style={s.anonName}>Anonymous</Text>
              <Text style={s.anonSub}>
                Your identity is hidden from other students
              </Text>
            </View>
          </View>

          {/* Text input */}
          <TextInput
            style={s.input}
            placeholder="Share something anonymously with campus..."
            placeholderTextColor="rgba(240,240,255,0.25)"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={500}
            autoFocus
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{body.length}/500</Text>

          {/* Disclaimer checkbox */}
          {/* <TouchableOpacity
            style={s.checkRow}
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.8}>
            <View style={[s.checkbox, agreed && s.checkboxChecked]}>
              {agreed && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={s.checkLabel}>
              I understand that while this post is anonymous to other users,{' '}
              <Text style={s.checkLabelBold}>school admins can identify me</Text>{' '}
              for safety and policy enforcement purposes.
            </Text>
          </TouchableOpacity> */}

          {/* Warning */}
          {/* <View style={s.warning}>
            <Ionicons name="warning-outline" size={14} color="#fbbf24" />
            <Text style={s.warningText}>
              Harassment, threats, or personal attacks will result in account suspension.
            </Text>
          </View> */}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1c1c2e",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "600", color: "#f0f0ff" },
  postBtn: {
    backgroundColor: "#f472b6",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: "center",
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  scrollContent: { padding: 16 },
  anonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    backgroundColor: "rgba(244,114,182,0.08)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5,
    borderColor: "rgba(244,114,182,0.2)",
  },
  anonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(244,114,182,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  anonName: { fontSize: 14, fontWeight: "600", color: "rgba(240,240,255,0.7)" },
  anonSub: { fontSize: 11, color: "rgba(240,240,255,0.35)", marginTop: 1 },
  input: {
    fontSize: 15,
    color: "#f0f0ff",
    minHeight: 160,
    lineHeight: 22,
    textAlignVertical: "top",
    marginBottom: 4,
  },
  charCount: {
    fontSize: 10,
    color: "rgba(240,240,255,0.25)",
    textAlign: "right",
    marginBottom: 20,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 16,
    backgroundColor: "#1c1c2e",
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: "#a78bfa", borderColor: "#a78bfa" },
  checkLabel: {
    flex: 1,
    fontSize: 12,
    color: "rgba(240,240,255,0.6)",
    lineHeight: 18,
  },
  checkLabelBold: { fontWeight: "600", color: "#f0f0ff" },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(251,191,36,0.08)",
    borderRadius: 10,
    padding: 10,
    borderWidth: 0.5,
    borderColor: "rgba(251,191,36,0.2)",
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: "rgba(251,191,36,0.8)",
    lineHeight: 16,
  },
});
