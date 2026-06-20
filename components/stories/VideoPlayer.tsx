import React, { useRef, useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av'

interface VideoPlayerProps {
  sourceUrl: string
  paused: boolean
  onLoad: () => void
}

export default function VideoPlayer({ sourceUrl, paused, onLoad }: VideoPlayerProps) {
  const videoRef = useRef<Video>(null)

  useEffect(() => {
    if (videoRef.current) {
      if (paused) {
        videoRef.current.pauseAsync().catch(() => {})
      } else {
        videoRef.current.playAsync().catch(() => {})
      }
    }
  }, [paused])

  const handleStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (status.isPlaying) {
        onLoad()
      } else if (!paused && !status.isBuffering) {
        videoRef.current?.playAsync().catch(() => {})
      }
    }
  }

  return (
    <Video
      ref={videoRef}
      source={{ uri: sourceUrl }}
      style={styles.video}
      resizeMode={ResizeMode.COVER}
      shouldPlay={!paused}
      isLooping={false}
      onLoad={onLoad}
      onPlaybackStatusUpdate={handleStatusUpdate}
      onError={(err) => console.log('[VideoPlayer] Playback error:', err)}
    />
  )
}

const styles = StyleSheet.create({
  video: {
    flex: 1,
    width: '100%',
  },
})
