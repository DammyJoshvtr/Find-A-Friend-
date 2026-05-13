import { useRef, useCallback } from 'react'
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native'
import { hideTabBar, showTabBar } from './tabBarAnim'

export function useTabBarScroll() {
  const lastY = useRef(0)

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const dy = y - lastY.current
    lastY.current = y
    if (y < 50) { showTabBar(); return }
    if (dy > 8) hideTabBar()
    else if (dy < -8) showTabBar()
  }, [])

  return { onScroll, scrollEventThrottle: 16 as const }
}
