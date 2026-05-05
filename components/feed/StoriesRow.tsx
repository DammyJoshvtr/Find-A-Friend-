/**
 * components/feed/StoriesRow.tsx
 * Horizontal scrollable row of story circles.
 */
import React, { useEffect } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useStoriesStore } from '../../store/storiesStore'
import { useAuthStore } from '../../store/authStore'
import StoryCircle from '../stories/StoryCircle'
import type { StoryGroup } from '../../lib/stories'

export default function StoriesRow() {
  const { groups, loading, loadStories } = useStoriesStore()
  const { user } = useAuthStore()

  useEffect(() => {
    loadStories()
  }, [loadStories])

  const handleAddStory = () => {
    router.push('/create-story' as `${string}`)
  }

  // Separate own group from others
  const ownGroup = groups.find(g => g.author_id === user?.id)
  const otherGroups = groups.filter(g => g.author_id !== user?.id)

  // Always show "Your story" circle first, even with 0 stories
  const ownPlaceholder: StoryGroup = ownGroup ?? {
    author_id: user?.id ?? 'own',
    author_name: 'You',
    author_avatar: null,
    all_viewed: true,
    stories: [],
  }

  return (
    <View style={s.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.content}>
        <StoryCircle
          group={ownPlaceholder}
          isOwn
          onAddStory={handleAddStory}
        />

        {loading && !groups.length ? (
          <ActivityIndicator
            color="#a78bfa"
            style={{ marginLeft: 10, alignSelf: 'center' }}
          />
        ) : (
          otherGroups.map(group => (
            <StoryCircle key={group.author_id} group={group} />
          ))
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  wrapper: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 16,
    gap: 2,
  },
})
