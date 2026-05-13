import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, ViewStyle } from 'react-native'

interface Props {
  width?: number | `${number}%`
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])

  return (
    <Animated.View style={[s.base, { width: width as any, height, borderRadius, opacity }, style]} />
  )
}

const s = StyleSheet.create({
  base: { backgroundColor: 'rgba(167,139,250,0.08)' },
})
