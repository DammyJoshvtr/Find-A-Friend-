import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'

interface VideoPlayerProps {
  sourceUrl: string
  paused: boolean
  onLoad: (duration?: number) => void
  onPlayingStateChange?: (isPlaying: boolean) => void
}

export default function VideoPlayer({ sourceUrl, paused, onLoad, onPlayingStateChange }: VideoPlayerProps) {
  const player = useVideoPlayer(sourceUrl, (p) => {
    p.loop = false
    if (!paused) {
      p.play()
    }
  })

  useEffect(() => {
    if (paused) {
      player.pause()
    } else {
      player.play()
    }
  }, [paused, player])

  useEffect(() => {
    if (player.status === 'readyToPlay') {
      onLoad(player.duration)
    }
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        onLoad(player.duration)
      }
    })
    const playingSub = player.addListener('playingChange', ({ isPlaying }) => {
      onPlayingStateChange?.(isPlaying)
    })
    return () => {
      subscription.remove()
      playingSub.remove()
    }
  }, [player, onLoad, onPlayingStateChange])

  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls={false}
      contentFit="cover"
    />
  )
}

const styles = StyleSheet.create({
  video: {
    flex: 1,
    width: '100%',
  },
})
