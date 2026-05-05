/**
 * components/stories/StoryCircle.tsx
 * Circular avatar with gradient ring — opens story viewer on press.
 */
import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getInitials } from '../../lib/matching'
import { useStoriesStore } from '../../store/storiesStore'
import type { StoryGroup } from '../../lib/stories'

interface StoryCircleProps {
  group: StoryGroup
  isOwn?: boolean
  onAddStory?: () => void
}

export default function StoryCircle({ group, isOwn, onAddStory }: StoryCircleProps) {
  const { openViewer } = useStoriesStore()

  const handlePress = () => {
    if (isOwn && group.stories.length === 0) {
      onAddStory?.()
      return
    }
    openViewer(group.author_id, 0)
  }

  const ringColor = group.all_viewed
    ? 'rgba(255,255,255,0.15)'
    : '#a78bfa'

  return (
    <TouchableOpacity style={s.container} onPress={handlePress}>
      <View style={[s.ring, { borderColor: ringColor }]}>
        {group.author_avatar ? (
          <Image source={{ uri: group.author_avatar }} style={s.avatar} />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.initials}>
              {getInitials(group.author_name ?? '?')}
            </Text>
          </View>
        )}

        {isOwn && (
          <View style={s.addBadge}>
            <Ionicons name="add" size={10} color="#fff" />
          </View>
        )}
      </View>

      <Text style={s.label} numberOfLines={1}>
        {isOwn ? 'Your story' : (group.author_name?.split(' ')[0] ?? 'User')}
      </Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 68,
    marginRight: 4,
  },
  ring: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    padding: 2,
    marginBottom: 5,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    backgroundColor: '#2a1e40',
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
    borderColor: '#0d0d14',
  },
  label: {
    fontSize: 10,
    color: 'rgba(240,240,255,0.6)',
    textAlign: 'center',
    maxWidth: 64,
  },
})
