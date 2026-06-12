import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import { ErrorBoundary } from "../components/ErrorBoundary";
import {
  registerForPushNotifications,
  savePushToken,
} from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { ThemeProvider, useTheme } from "../lib/theme";
import { useAuthStore } from "../store/authStore";
import { useFeedStore } from "../store/feedStore";
import { useNotificationsStore } from "../store/notificationsStore";
import { usePresenceStore } from "../store/presenceStore";
import { useThemeStore } from "../store/themeStore";

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppStack() {
  const { session, setSession } = useAuthStore();
  const segments = useSegments();
  const [mounted, setMounted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setSession(session),
    );
    return () => subscription.unsubscribe();
  }, []);

  const { addNotification, loadUnreadCount } = useNotificationsStore();
  const { setOnlineUsers } = usePresenceStore();
  const removePost = useFeedStore((s) => s.removePost);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );

  useEffect(() => {
    if (!session) return;

    // Push notification registration (native)
    registerForPushNotifications().then((token) => {
      if (token) savePushToken(token);
    });

    // Web Push subscription (iOS PWA / Android PWA — background push via VAPID)
    if (Platform.OS === "web") {
      subscribeToWebPush(session.user.id);
    }

    // Load initial unread count
    loadUnreadCount();

    // ── Presence channel ────────────────────────────────────────────────────
    // Supabase Presence automatically removes users when they disconnect
    // (app killed, network loss, crash) — far more reliable than writing to DB.
    const presenceChannel = supabase.channel("online-users", {
      config: { presence: { key: session.user.id } },
    });

    const syncOnlineUsers = () => {
      const state = presenceChannel.presenceState();
      setOnlineUsers(Object.keys(state));
    };

    presenceChannel
      .on("presence", { event: "sync" }, syncOnlineUsers)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: session.user.id,
            online_at: Date.now(),
          });
        }
      });

    presenceChannelRef.current = presenceChannel;

    // ── AppState: re-track on foreground, untrack on background ────────────
    const appStateSub = AppState.addEventListener(
      "change",
      async (nextState) => {
        if (!presenceChannelRef.current) return;
        if (nextState === "active") {
          await presenceChannelRef.current.track({
            user_id: session.user.id,
            online_at: Date.now(),
          });
          // Re-register push token in case it was rotated by the OS
          registerForPushNotifications().then((token) => {
            if (token) savePushToken(token);
          });
          // Pick up any OTA update that landed while the app was backgrounded
          checkForUpdate();
        } else {
          await presenceChannelRef.current.untrack();
        }
      },
    );

    // ── In-app notification subscription ───────────────────────────────────
    const notifChannel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload: any) => {
          addNotification(payload.new);
        },
      )
      .subscribe();

    // ── Dashboard-triggered OTA updates + post deletions ──────────────────
    const updateChannel = supabase
      .channel("app-updates")
      .on("broadcast", { event: "force_update" }, () => checkForUpdate())
      .on("broadcast", { event: "post_deleted" }, (payload: any) => {
        const id = payload.payload?.postId as string | undefined;
        if (id) removePost(id);
      })
      .subscribe();

    return () => {
      presenceChannelRef.current?.untrack();
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(updateChannel);
      appStateSub.remove();
      presenceChannelRef.current = null;
    };
  }, [session?.user?.id, removePost]);

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
    </>
  );
}

async function subscribeToWebPush(userId: string) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;
    const vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    // Convert base64url VAPID key to Uint8Array
    const key = vapidKey.replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(key);
    const applicationServerKey = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++)
      applicationServerKey[i] = raw.charCodeAt(i);

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!p256dh || !auth) return;

    const { supabase } = await import("../lib/supabase");
    await supabase.from("web_push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh,
        auth,
      },
      { onConflict: "user_id" },
    );
  } catch {}
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

  useEffect(() => {
    hydrate();
    checkForUpdate();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <AppStack />
          <Toast />
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
