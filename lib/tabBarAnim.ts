import { Animated } from 'react-native'

export const tabBarTranslateY = new Animated.Value(0)

// Enough to push the tallest tab bar (60 + 34 safe area) off screen
const SLIDE_DISTANCE = 100
let _hidden = false

export function hideTabBar() {
  if (_hidden) return
  _hidden = true
  Animated.timing(tabBarTranslateY, {
    toValue: SLIDE_DISTANCE,
    duration: 220,
    useNativeDriver: true,
  }).start()
}

export function showTabBar() {
  if (!_hidden) return
  _hidden = false
  Animated.timing(tabBarTranslateY, {
    toValue: 0,
    duration: 220,
    useNativeDriver: true,
  }).start()
}
