/**
 * test-push.mjs
 * Sends a real push notification to your device to prove it works outside the app.
 * Usage: node test-push.mjs <your-service-role-key>
 */

const SUPABASE_URL = 'https://vcbtvhociaioeyhhsczh.supabase.co'
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) {
  console.error('Usage: node test-push.mjs <service-role-key>')
  process.exit(1)
}

// 1. Fetch a push token from any profile that has one
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/profiles?push_token=not.is.null&select=id,full_name,push_token&limit=1`,
  {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  }
)

const profiles = await res.json()

if (!profiles.length || !profiles[0].push_token) {
  console.error('No push token found. Open the app on your device first, then retry.')
  process.exit(1)
}

const { full_name, push_token } = profiles[0]
console.log(`Sending test push to: ${full_name ?? 'User'} (token: ${push_token.slice(0, 30)}...)`)

// 2. Send push via Expo
const pushRes = await fetch(EXPO_PUSH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({
    to: push_token,
    title: 'FAF 🔔',
    body: 'Push notifications are working on your device!',
    sound: 'default',
    channelId: 'default',
    data: { route: '/notifications' },
  }),
})

const result = await pushRes.json()

if (result.data?.status === 'ok') {
  console.log('✅ Push sent! Check your device notification tray.')
} else {
  console.log('Response:', JSON.stringify(result, null, 2))
}
