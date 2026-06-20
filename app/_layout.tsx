import { useEffect, useState, useRef } from 'react'
import { AppState, Platform, Alert, View, useWindowDimensions } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Stack, router, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as Updates from 'expo-updates'
import Toast from 'react-native-toast-message'
import { client, subscribeToChannel } from '../lib/aws';
import '../lib/aws'
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { useNotificationsStore } from '../store/notificationsStore'
import { usePresenceStore } from '../store/presenceStore'
import { useFeedStore } from '../store/feedStore'
import { useStreakStore } from '../store/streakStore'
import { ThemeProvider, useTheme } from '../lib/theme'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { WebPushBanner } from '../components/WebPushBanner'
import { StreakModal } from '../components/StreakModal'
import { GAME_META, type GameType } from '../lib/games'
import { 
  registerForPushNotifications, 
  savePushToken,
  subscribeToWebPush,
  getNotifications,
  sendLocalNotification
} from '../lib/notifications'
import * as Notifications from 'expo-notifications'
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Ionicons } from "@expo/vector-icons";

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppStack() {
  const { session, user, setSession } = useAuthStore();
  const segments = useSegments();
  const [mounted, setMounted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    setMounted(true);
    
    const initAuth = async () => {
      try {
        const session = await fetchAuthSession();
        const user = await getCurrentUser();
        setSession(session, user);
      } catch (err) {
        setSession(null, null);
      } finally {
        setInitialized(true);
      }
    };
    initAuth();

    const hubListenerCancel = Hub.listen('auth', (data) => {
      if (data.payload.event === 'signedIn') {
        initAuth();
      } else if (data.payload.event === 'signedOut') {
        setSession(null, null);
      }
    });
    
    return () => hubListenerCancel();
  }, []);

  const { addNotification, loadUnreadCount } = useNotificationsStore();
  const { setOnlineUsers } = usePresenceStore();
  const removePost = useFeedStore((s) => s.removePost);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );

  useEffect(() => {
    if (!session || !user) return;

    // Push notification registration (native)
    registerForPushNotifications().then((token) => {
      if (token) savePushToken(token);
    });

    // Web Push subscription (iOS PWA / Android PWA — background push via VAPID)
    if (Platform.OS === "web") {
      subscribeToWebPush(user.userId);
    }

    // Load initial unread count
    loadUnreadCount();

    // Check streak
    useStreakStore.getState().recordDailyActivity();
    // ── Presence & Active Users Fallback (Database-backed Heartbeat) ───────────
    const updatePresence = async () => {
      if (!user?.userId) return
      try {
        await client.models.profiles.update({ id: user.userId, last_active_date: new Date().toISOString() })
      } catch (err) {
        console.warn('Failed to update presence heartbeat:', err)
      }
    }

    const fetchOnlineUsers = async () => {
      if (!user?.userId) return
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const { data, errors } = await client.models.profiles.list({
          filter: { last_active_date: { gt: fiveMinutesAgo } }
        })

        if (errors) throw errors
        if (data) {
          setOnlineUsers(data.map(d => d.id))
        }
      } catch (err) {
        console.warn('Failed to fetch online users presence:', err)
      }
    }

    updatePresence()
    fetchOnlineUsers()

    const presenceHeartbeat = setInterval(updatePresence, 30000)
    const presenceFetchInterval = setInterval(fetchOnlineUsers, 30000)

    // ── AppState: re-track on foreground ─────────────────────────────────────
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        updatePresence()
        fetchOnlineUsers()
        // Re-register push token in case it was rotated by the OS
        registerForPushNotifications().then(token => { if (token) savePushToken(token) })
        // Pick up any OTA update that landed while the app was backgrounded
        checkForUpdate()
        // Check daily streak
        useStreakStore.getState().recordDailyActivity()
      }
    })

    // ── In-app notification polling subscription ───────────────────────────
    // Load notifications initially
    useNotificationsStore.getState().loadNotifications()

    const pollInterval = setInterval(async () => {
      if (!user?.userId) return
      try {
        const store = useNotificationsStore.getState()
        const existingIds = new Set(store.notifications.map(n => n.id))

        // Fetch the 5 most recent notifications
        const { data, error } = await getNotifications(false, 5)
        if (error || !data) return

        // Find new notifications
        const newNotifications = data.filter(n => !existingIds.has(n.id))

        if (newNotifications.length > 0) {
          // Add them (oldest first so store ordering is correct)
          newNotifications.reverse().forEach(n => {
            store.addNotification(n)

            // Trigger local push notification
            sendLocalNotification(
              n.type === 'like' ? 'New Like! ❤️' : 'New Notification! 🔔',
              n.body || 'You have new activity on your profile.'
            )
          })
        }
      } catch (err) {
        console.warn('Failed to poll notifications:', err)
      }
    }, 15000)

    // ── Dashboard-triggered OTA updates + post deletions ──────────────────
    const updateChannel = subscribeToChannel("app-updates", (event, payload) => {
      if (event === "force_update") checkForUpdate();
      else if (event === "post_deleted") {
        const id = payload?.postId as string | undefined;
        if (id) removePost(id);
      }
    });

    // ── Game challenge interception ──────────────────────────────────────────
    // Listen for incoming game challenges in the messages table.
    const gameChannel = client.models.messages.onCreate().subscribe({
      next: async (data) => {
        try {
          const msg = data;
          // Only process messages sent TO the current user (not by them)
          if (msg.sender_id === user.userId) return
          let body: any = null
          try { body = JSON.parse(msg.body || '') } catch { return }
          if (body?._type !== 'game_challenge') return

          const gt = body.gameType as GameType
          const meta = GAME_META[gt]
          if (!meta) return

          // Fetch challenger's name
          const { data: challenger } = await client.models.profiles.get({ id: msg.sender_id || '' });
          const challengerName = challenger?.full_name ?? 'Someone'

          Alert.alert(
            `${meta.emoji} Game Challenge!`,
            `${challengerName} challenged you to ${meta.label}!`,
            [
              {
                text: 'Decline ✕',
                style: 'cancel',
              },
              {
                text: 'Accept ✓',
                onPress: () => {
                  router.push({
                    pathname: '/play/waiting' as any,
                    params: {
                      gameType: gt,
                      opponentId: msg.sender_id,
                      opponentName: challengerName,
                    },
                  })
                },
              },
            ]
          )
        } catch {
          // Non-fatal — ignore malformed messages
        }
      }
    });

    return () => {
      clearInterval(presenceHeartbeat)
      clearInterval(presenceFetchInterval)
      clearInterval(pollInterval)
      updateChannel.unsubscribe()
      gameChannel.unsubscribe()
      appStateSub.remove()
      presenceChannelRef.current = null
    }
  }, [session, user?.userId, removePost])

  useEffect(() => {
    if (!mounted || !initialized) return;
    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth) router.replace("/(auth)/welcome");
  }, [session, segments, mounted, initialized]);

  useEffect(() => {
    // User tapped the notification
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const type = data?.type as string | undefined;
        // Force/soft update — check and apply OTA update immediately
        if (type === "force_update" || type === "soft_update") {
          checkForUpdate();
          return;
        }
        if (data?.route) router.push(data.route as any);
        else if (data?.actorId) router.push(`/profile/${data.actorId}` as any);
        else router.push("/notifications" as any);
      },
    );

    // Notification received while app is in foreground — apply immediately
    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if ((data?.type as string) === "force_update") checkForUpdate();
      },
    );

    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, []);

  if (!initialized) return null;

  return (
    <>
      <StatusBar style={theme.statusBar} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="create-post" />
        <Stack.Screen name="hashtag/[tag]" />
        <Stack.Screen name="create-story" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="create-event" />
        <Stack.Screen name="anonymous" />
        <Stack.Screen name="create-anonymous-post" />
        <Stack.Screen name="clubs" />
        <Stack.Screen name="club/[id]" />
        <Stack.Screen name="academic" />
        <Stack.Screen name="study-group/[id]" />
        <Stack.Screen name="course/[id]" />
        <Stack.Screen name="vendors" />
        <Stack.Screen name="vendor/[id]" />
        <Stack.Screen name="vendor-apply" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="map" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="bookmarks" />
        <Stack.Screen name="appearance" />
        <Stack.Screen name="privacy-settings" />
        <Stack.Screen name="help" />
        <Stack.Screen name="verification" />
        <Stack.Screen name="followers/[id]" />
        <Stack.Screen name="following/[id]" />
        <Stack.Screen name="deals" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="games" />
        <Stack.Screen name="game-lobby/[gameType]" />
        <Stack.Screen name="leaderboard/[gameType]" />
        <Stack.Screen name="play/waiting" />
        <Stack.Screen name="discover-likes" />
        <Stack.Screen name="club-room/[id]" />
        <Stack.Screen name="study-room/[id]" />
        <Stack.Screen name="feedback" />
      </Stack>
      {/* Show push-permission banner for existing iOS PWA users */}
      {Platform.OS === 'web' && session && user && (
        <WebPushBanner userId={user.userId} />
      )}
    </>
  );
}


async function checkForUpdate() {
  if (Platform.OS === "web") {
    // On web (PWA): tell the service worker to check for a new version.
    // The SW will post SW_UPDATED to all clients after it activates,
    // and +html.tsx reloads the page in response.
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      }
    } catch {}
    return;
  }
  // Native (Android/iOS): use Expo OTA updates
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {}
}

export default function RootLayout() {
  const { hydrate } = useThemeStore();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    ...Ionicons.font,
  });

  const authLoading = useAuthStore((s) => s.loading);

  useEffect(() => {
    hydrate();
    checkForUpdate();
  }, []);

  useEffect(() => {
    if (fontsLoaded && !authLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, authLoading]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <ResponsiveAppContainer>
            <AppStack />
            <StreakModal />
            <Toast />
          </ResponsiveAppContainer>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

function ResponsiveAppContainer({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  // On web, if screen is wider than typical mobile/tablet, center it with a max-width
  const isLargeScreen = Platform.OS === 'web' && width > 600;

  if (isLargeScreen) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.base || '#0a0a0a', alignItems: 'center' }}>
        <View 
          style={{ 
            flex: 1, 
            width: '100%', 
            maxWidth: 500, 
            backgroundColor: theme.bg,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: theme.border || 'rgba(150,150,150,0.1)',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 20,
            elevation: 10
          }}
        >
          {children}
        </View>
      </View>
    );
  }

  return <View style={{ flex: 1 }}>{children}</View>;
}
