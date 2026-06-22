import { Platform } from "react-native";

// Central feature flag configuration
export const VIDEO_STORIES_ENABLED = true;

/**
 * Checks whether the current native build supports video stories (requires expo-video).
 * Dynamically checks the native modules registry to prevent crashes on older builds.
 */
export function supportsVideoStories(): boolean {
  if (!VIDEO_STORIES_ENABLED) {
    return false;
  }

  // Web supports standard HTML5 video elements
  if (Platform.OS === "web") {
    return true;
  }

  try {
    const { requireNativeModule } = require("expo-modules-core");
    return !!requireNativeModule("ExpoVideo");
  } catch (e) {
    return false;
  }
}
