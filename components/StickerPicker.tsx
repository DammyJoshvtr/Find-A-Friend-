import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, Image, ActivityIndicator, Dimensions
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../lib/theme'
import { typography } from '../lib/typography'
import { useStickerStore } from '../store/stickerStore'

interface StickerPickerProps {
  visible: boolean
  onClose: () => void
  onSelectSticker: (url: string) => void
}

const { height: screenHeight } = Dimensions.get('window')

export function StickerPicker({ visible, onClose, onSelectSticker }: StickerPickerProps) {
  const theme = useTheme()
  const { stickers, loading, loaded, loadStickers, removeSticker } = useStickerStore()
  
  useEffect(() => {
    if (visible && !loaded && !loading) {
      loadStickers()
    }
  }, [visible, loaded, loading])

  const renderItem = ({ item }: { item: { id: string, media_url: string } }) => (
    <View style={s.stickerItemWrap}>
      <TouchableOpacity
        style={[s.stickerItem, { borderColor: theme.border }]}
        onPress={() => onSelectSticker(item.media_url)}
      >
        <Image source={{ uri: item.media_url }} style={s.stickerImg} resizeMode="contain" />
      </TouchableOpacity>
      <TouchableOpacity
        style={s.deleteBtn}
        onPress={() => removeSticker(item.id)}
      >
        <Ionicons name="close-circle" size={20} color={theme.textMuted} />
      </TouchableOpacity>
    </View>
  )

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[s.sheet, { backgroundColor: theme.card, height: screenHeight * 0.6 }]}>
          <View style={[s.header, { borderBottomColor: theme.border }]}>
            <View style={{ width: 32 }} />
            <Text style={[s.title, { color: theme.text }]}>My Stickers</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {loading && !loaded ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : stickers.length === 0 ? (
            <View style={s.center}>
              <Ionicons name="happy-outline" size={48} color={theme.textFaint} />
              <Text style={[s.emptyTitle, { color: theme.text }]}>No Stickers Yet</Text>
              <Text style={[s.emptyDesc, { color: theme.textMuted }]}>
                Long-press any image in a chat or comment to save it as a sticker!
              </Text>
            </View>
          ) : (
            <FlatList
              data={stickers}
              keyExtractor={s => s.id}
              numColumns={3}
              renderItem={renderItem}
              contentContainerStyle={s.listContent}
              columnWrapperStyle={s.listCol}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
  },
  closeBtn: {
    width: 32, height: 32,
    alignItems: 'flex-end', justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  listCol: {
    gap: 12,
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  stickerItemWrap: {
    position: 'relative',
    width: '31%',
    aspectRatio: 1,
  },
  stickerItem: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  stickerImg: {
    width: '100%',
    height: '100%',
  },
  deleteBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
  },
})
