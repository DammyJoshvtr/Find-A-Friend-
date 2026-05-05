/**
 * components/stories/StoryViewer.tsx
 * Full-screen story viewer with progress bars, tap navigation, and auto-advance.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Dimensions,
  StatusBar,
  PanResponder,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useStoriesStore, selectCurrentStory, selectCurrentGroup } from '../../store/storiesStore'
import { getInitials, getTimeAgo } from '../../lib/matching'

const { width: SCREEN_W } = Dimensions.get('window')
const STORY_DURATION = 5000

export default function StoryViewer() {
  const {
    viewerGroupId,
    viewerIndex,
    closeViewer,
    advanceViewer,
    markViewed,
    groups,
  } = useStoriesStore()

  const story = useStoriesStore(selectCurrentStory)
  const group = useStoriesStore(selectCurrentGroup)

  const progressAnim = useRef(new Animated.Value(0)).current
  const progressRef = useRef<Animated.CompositeAnimation | null>(null)
  const [paused, setPaused] = useState(false)

  const visible = !!viewerGroupId

  const startProgress = useCallback(() => {
    progressAnim.setValue(0)
    progressRef.current?.stop()
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: (story?.duration_secs ?? 5) * 1000,
      useNativeDriver: false,
    })
    progressRef.current.start(({ finished }) => {
      if (finished) {
        handleNext()
      }
    })
  }, [story, progressAnim])

  useEffect(() => {
    if (visible && story) {
      markViewed(story.id)
      if (!paused) startProgress()
    }
    return () => {
      progressRef.current?.stop()
    }
  }, [viewerGroupId, viewerIndex, visible])

  useEffect(() => {
    if (paused) {
      progressRef.current?.stop()
    } else if (visible && story) {
      startProgress()
    }
  }, [paused])

  const handleNext = () => {
    progressRef.current?.stop()
    advanceViewer()
  }

  const handlePrev = () => {
    progressRef.current?.stop()
    const groupIdx = groups.findIndex(g => g.author_id === viewerGroupId)
    if (groupIdx === -1) return
    if (viewerIndex > 0) {
      useStoriesStore.setState({ viewerIndex: viewerIndex - 1 })
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1]
      useStoriesStore.setState({
        viewerGroupId: prevGroup.author_id,
        viewerIndex: prevGroup.stories.length - 1,
      })
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setPaused(true),
      onPanResponderRelease: () => setPaused(false),
    })
  ).current

  if (!visible || !story || !group) return null

  const groupIdx = groups.findIndex(g => g.author_id === viewerGroupId)
  const storiesInGroup = group.stories.length

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <StatusBar hidden />
      <View style={s.container}>
        {/* Story image */}
        <Image
          source={{ uri: story.media_url }}
          style={s.media}
          resizeMode="cover"
        />

        {/* Dark gradient overlay */}
        <View style={s.topGradient} />
        <View style={s.bottomGradient} />

        {/* Progress bars */}
        <View style={s.progressBars}>
          {Array.from({ length: storiesInGroup }).map((_, i) => (
            <View key={i} style={s.progressTrack}>
              <Animated.View
                style={[
                  s.progressFill,
                  {
                    width:
                      i < viewerIndex
                        ? '100%'
                        : i === viewerIndex
                        ? progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          })
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={s.header}>
          <View style={s.authorRow}>
            <View style={s.authorAvatar}>
              {group.author_avatar ? (
                <Image source={{ uri: group.author_avatar }} style={s.authorAvatarImg} />
              ) : (
                <Text style={s.authorInitials}>
                  {getInitials(group.author_name ?? '?')}
                </Text>
              )}
            </View>
            <View>
              <Text style={s.authorName}>{group.author_name ?? 'User'}</Text>
              <Text style={s.storyTime}>{getTimeAgo(story.created_at)}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={closeViewer} style={s.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Caption */}
        {story.caption ? (
          <View style={s.captionWrap}>
            <Text style={s.caption}>{story.caption}</Text>
          </View>
        ) : null}

        {/* Tap zones */}
        <View style={s.tapZones} {...panResponder.panHandlers}>
          <TouchableOpacity
            style={s.tapLeft}
            onPress={handlePrev}
            activeOpacity={1}
          />
          <TouchableOpacity
            style={s.tapRight}
            onPress={handleNext}
            activeOpacity={1}
          />
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  media: {
    flex: 1,
    width: '100%',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'transparent',
    // simulated gradient via opacity layers
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  progressBars: {
    position: 'absolute',
    top: 50,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    top: 62,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a1e40',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  authorAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  authorInitials: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  authorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  storyTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionWrap: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
  },
  caption: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tapZones: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 1,
  },
})
