import React, { useEffect } from 'react'
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useStoriesStore } from '../../store/storiesStore'
import { useAuthStore } from '../../store/authStore'
import StoryCircle from '../stories/StoryCircle'
import { useTheme } from '../../lib/theme'
import type { StoryGroup } from '../../lib/stories'

export default function StoriesRow() {
  const { groups, loading, loadStories } = useStoriesStore()
  const { user } = useAuthStore()
  const theme = useTheme()

  useEffect(() => { loadStories() }, [loadStories])

  const ownGroup = groups.find(g => g.author_id === user?.id)
  const otherGroups = groups.filter(g => g.author_id !== user?.id)

  const ownPlaceholder: StoryGroup = ownGroup ?? {
    author_id: user?.id ?? 'own',
    author_name: 'You',
    author_avatar: null,
    all_viewed: true,
    stories: [],
  }

  return (
    <View style={[s.wrapper, { borderBottomColor: theme.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.content}>
        <StoryCircle group={ownPlaceholder} isOwn onAddStory={() => router.push('/create-story' as `${string}`)} />
        {loading && !groups.length ? (
          <ActivityIndicator color={theme.accent} style={{ marginLeft: 10, alignSelf: 'center' }} />
        ) : (
          otherGroups.map(group => <StoryCircle key={group.author_id} group={group} />)
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  wrapper: { paddingVertical: 10, borderBottomWidth: 0.5, marginBottom: 8 },
  content: { paddingHorizontal: 16, gap: 2 },
})
