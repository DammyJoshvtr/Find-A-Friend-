import React, { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getInitials } from '../../lib/matching'
import { useStoriesStore } from '../../store/storiesStore'
import type { StoryGroup } from '../../lib/stories'
import { useTheme } from '../../lib/theme'

interface StoryCircleProps {
  group: StoryGroup
  isOwn?: boolean
  onAddStory?: () => void
}

export default function StoryCircle({ group, isOwn, onAddStory }: StoryCircleProps) {
  const { openViewer } = useStoriesStore()
  const theme = useTheme()
  const glowAnim = useRef(new Animated.Value(0.3)).current

  const hasUnviewed = !group.all_viewed

  useEffect(() => {
    if (!hasUnviewed) return
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.8, duration: 900, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [hasUnviewed])

  const handlePress = () => {
    if (isOwn && group.stories.length === 0) {
      onAddStory?.()
      return
    }
    openViewer(group.author_id, 0)
  }

  const ringColor = hasUnviewed ? '#a78bfa' : theme.border

  return (
    <TouchableOpacity style={s.container} onPress={handlePress}>
      {/* Animated glow halo behind ring for unviewed stories */}
      {hasUnviewed && (
        <Animated.View style={[s.glowHalo, { opacity: glowAnim }]} />
      )}

      <View style={[s.ring, { borderColor: ringColor }]}>
        {group.author_avatar ? (
          <Image source={{ uri: group.author_avatar }} style={s.avatar} />
        ) : (
          <View style={[s.avatarFallback, { backgroundColor: theme.card2 }]}>
            <Text style={s.initials}>
              {getInitials(group.author_name ?? '?')}
            </Text>
          </View>
        )}

        {isOwn && (
          <TouchableOpacity
            style={[s.addBadge, { borderColor: theme.card }]}
            onPress={() => onAddStory?.()}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="add" size={10} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[s.label, { color: theme.textMuted }]} numberOfLines={1}>
        {isOwn ? 'Your story' : (group.author_name?.split(' ')[0] ?? 'User')}
      </Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 72,
    marginRight: 4,
  },
  glowHalo: {
    position: 'absolute',
    top: -4,
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'transparent',
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  ring: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    padding: 2,
    marginBottom: 5,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c4b5fd',
  },
  addBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#a78bfa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  label: {
    fontSize: 10,
    textAlign: 'center',
    maxWidth: 68,
  },
})
