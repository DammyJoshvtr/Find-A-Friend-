import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme, glowShadow } from '../../lib/theme'
import { BlurView } from 'expo-blur'
import { StyleSheet, Platform, View } from 'react-native'
import { useNotificationsStore } from '../../store/notificationsStore'
import { tabBarTranslateY, showTabBar } from '../../lib/tabBarAnim'

function TabIcon({ name, color, size, focused }: { name: any; color: string; size: number; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={size} color={color} />
      {focused && (
        <View style={styles.activeDot} />
      )}
    </View>
  )
}

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const unreadCount = useNotificationsStore(s => s.unreadCount)

  return (
    <Tabs
      screenListeners={{ tabPress: () => showTabBar() }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.cardSolid,
          borderTopColor: 'rgba(167,139,250,0.25)',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 4,
          elevation: 0,
          transform: [{ translateY: tabBarTranslateY }],
        },
        // App is always dark — use 'dark' tint unconditionally
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView tint="dark" intensity={80} style={StyleSheet.absoluteFill} />
          ) : null,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="home" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="search" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="calendar" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="chatbubbles" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="grid" color={color} size={size} focused={focused} />
          ),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#ef4444', fontSize: 10 },
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    gap: 3,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#a78bfa',
    ...glowShadow,
  },
})
