import { NativeModules, Platform } from 'react-native'

// Central feature flag configuration
export const VIDEO_STORIES_ENABLED = true

/**
 * Checks whether the current native build supports video stories (requires expo-av).
 * Dynamically checks the native modules registry to prevent crashes on older builds.
 */
export function supportsVideoStories(): boolean {
  if (!VIDEO_STORIES_ENABLED) {
    return false
  }

  // Web does not crash on native module imports of expo-av, but we can verify support
  if (Platform.OS === 'web') {
    return true
  }

  // Check both standard Expo Go/development environments and standalone builds
  const hasExpoAV = !!NativeModules.ExpoAV || !!NativeModules.ExponentAV

  return hasExpoAV
}
