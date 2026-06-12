# `_layout.tsx` Code Explanation

This file explains the key functions and behavior found in `app/_layout.tsx`.
It is intended as a reference for developers who want to understand how app navigation, web push registration, and update handling work in this project.

## `RootLayout`

`RootLayout` is the top-level React component for the app layout. It does three main things:

- Loads fonts using `useFonts`, including `PlusJakartaSans` font variants and `Ionicons.font`.
- Hides the splash screen once fonts are ready.
- Wraps the app in UI providers and renders the main app stack.

Important pieces:

- `useThemeStore().hydrate()` initializes theme state.
- `SplashScreen.hideAsync()` is called after fonts are loaded.
- `GestureHandlerRootView` ensures gesture handling is available throughout the app.
- `ErrorBoundary` catches rendering errors.

## `AppStack`

`AppStack` is the component responsible for configuring the app's navigation flow and maintaining several app-level background behaviors.
It uses `expo-router`'s `<Stack>` to declare every route/screen in the app and also handles authentication, presence, notifications, and update-related state.

### What `AppStack` does

1. Auth state initialization
   - On mount, it calls `supabase.auth.getSession()` to restore the current session.
   - It stores that session in the auth store using `setSession(session)`.
   - It also subscribes to Supabase auth state changes so the app stays updated if the user signs in or out.

2. Web push registration
   - When a valid session exists, it calls `registerForPushNotifications()` and forwards the returned token to `savePushToken(token)`.
   - On web, it also calls `subscribeToWebPush(session.user.id)` to register the browser for push notifications.

3. Presence and real-time state
   - It creates a Supabase presence channel named `online-users` and tracks the current user as online.
   - It syncs the online user list so the app knows who is currently connected.
   - It also updates presence when the app moves between foreground and background.

4. Notifications and real-time updates
   - It subscribes to a `user-notifications` database channel and adds incoming notifications to the notification store.
   - It subscribes to an `app-updates` broadcast channel for two events:
     - `force_update`: triggers `checkForUpdate()` immediately
     - `post_deleted`: removes a deleted post from local state

5. Navigation guard
   - After the app mounts and initializes, if the user is not authenticated and the current route is not an auth route, `AppStack` redirects to `/(auth)/welcome`.

### How `AppStack` works

`AppStack` uses React hooks to coordinate app lifecycle behavior:

- `useEffect(() => { ... }, [])` is used to initialize auth and subscription state on first render.
- `useEffect(() => { ... }, [session?.user?.id, removePost])` manages push registration, presence channels, and real-time subscriptions whenever the user session changes.
- `useEffect(() => { ... }, [session, segments, mounted, initialized])` ensures unauthenticated users are redirected to login.
- `useEffect(() => { ... }, [])` listens for notification interactions and foreground notification delivery.

The navigation stack itself is declared via `<Stack.Screen>` for each screen route in the app.

## `subscribeToWebPush(userId)`

This function is a web-only helper for registering the browser with push notifications.

### What it does

- Checks whether the browser supports `serviceWorker` and `PushManager`.
- Requests notification permission from the user.
- Waits for the service worker registration to become ready.
- Converts a VAPID public key from the environment into a `Uint8Array`.
- Calls `pushManager.subscribe()` with `userVisibleOnly: true` and the application server key.
- Saves the resulting endpoint and encryption keys to Supabase in the `web_push_subscriptions` table.

### Why it exists

Native apps use Expo push notification tokens, but web PWAs need a browser push subscription.
This function attaches the browser subscription information to the backend so web push notifications can be delivered to the current user.

## `checkForUpdate()`

This function checks for app updates and applies them depending on the current platform.

### Web behavior

- If the app is running in a web browser, it attempts to update the registered service worker.
- This is the normal way a PWA can detect and load a new web app version.

### Native behavior

- If the app is running on Android or iOS, it uses `expo-updates`:
  - `Updates.checkForUpdateAsync()` checks whether a new OTA update is available.
  - `Updates.fetchUpdateAsync()` downloads the update.
  - `Updates.reloadAsync()` restarts the app so the new code is applied.

### Why it exists

This function lets the app receive and apply over-the-air updates without waiting for a full app store release.
It is used in the app to keep users on the latest version after a `force_update` event or when the app comes back into the foreground.

## Summary

- `RootLayout` is the app root wrapper that loads fonts, initializes theme state, and renders the main stack.
- `AppStack` is the primary routing and app lifecycle manager for authentication, presence, notifications, and update handling.
- `subscribeToWebPush()` registers browser push subscriptions for web users.
- `checkForUpdate()` updates the app: service worker refresh on web, Expo OTA on native.

This file is meant to help you understand how the app starts, how it keeps users connected, and how it stays up to date.
