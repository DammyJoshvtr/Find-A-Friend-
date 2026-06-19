import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme";
import { typography } from "../../lib/typography";

const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

export function MessageActionsModal({
  msg,
  mine,
  onClose,
  onEdit,
  onDelete,
  onReact,
  onReply,
  onSaveSticker,
}: {
  msg: any;
  mine: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onSaveSticker?: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={ma.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={[
          ma.sheet,
          { backgroundColor: theme.card2, borderColor: theme.accentBorder },
        ]}
      >
        <View style={[ma.handle, { backgroundColor: theme.border2 }]} />

        {/* Emoji reactions row */}
        <View style={ma.reactRow}>
          {REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[
                ma.reactBtn,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => {
                onReact(emoji);
                onClose();
              }}
            >
              <Text style={ma.reactEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[ma.divider, { backgroundColor: theme.border }]} />

        <TouchableOpacity
          style={ma.actionRow}
          onPress={() => {
            onReply();
            onClose();
          }}
        >
          <Ionicons name="arrow-undo-outline" size={18} color={theme.accent} />
          <Text style={[ma.actionLabel, { color: theme.text }]}>Reply</Text>
        </TouchableOpacity>

        {onSaveSticker && (
          <TouchableOpacity
            style={ma.actionRow}
            onPress={() => {
              onSaveSticker();
              onClose();
            }}
          >
            <Ionicons name="star-outline" size={18} color="#eab308" />
            <Text style={[ma.actionLabel, { color: theme.text }]}>
              ⭐ Save as Sticker
            </Text>
          </TouchableOpacity>
        )}

        {mine && (
          <TouchableOpacity
            style={ma.actionRow}
            onPress={() => {
              onEdit();
              onClose();
            }}
          >
            <Ionicons name="pencil-outline" size={18} color={theme.accent} />
            <Text style={[ma.actionLabel, { color: theme.text }]}>
              Edit message
            </Text>
          </TouchableOpacity>
        )}
        {mine && (
          <TouchableOpacity
            style={ma.actionRow}
            onPress={() => {
              onDelete();
              onClose();
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#f87171" />
            <Text style={[ma.actionLabel, { color: "#f87171" }]}>
              Delete message
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={ma.cancelRow} onPress={onClose}>
          <Text style={[ma.cancelLabel, { color: theme.textMuted }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const ma = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 34,
    borderWidth: 0.5,
    borderBottomWidth: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  reactRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  reactBtn: { padding: 8, borderRadius: 14, borderWidth: 0.5 },
  reactEmoji: { fontSize: 26 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  actionLabel: { fontSize: 15, fontFamily: typography.fontMedium },
  cancelRow: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  cancelLabel: { fontSize: 14, fontFamily: typography.fontMedium },
});
