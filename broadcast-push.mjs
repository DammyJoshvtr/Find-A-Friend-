/**
 * broadcast-push.mjs
 * Sends a push notification to ALL users who have a push token.
 * Usage: node broadcast-push.mjs <service-role-key>
 */

const SUPABASE_URL = 'https://vcbtvhociaioeyhhsczh.supabase.co'
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) {
  console.error('Usage: node broadcast-push.mjs <service-role-key>')
  process.exit(1)
}

// 1. Fetch all profiles with a push token
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/profiles?push_token=not.is.null&select=id,full_name,push_token`,
  {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  }
)

const profiles = await res.json()

if (!profiles.length) {
  console.error('No users with push tokens found.')
  process.exit(1)
}

console.log(`Found ${profiles.length} user(s) with push tokens. Sending broadcast...`)

// 2. Build messages for all users
const messages = profiles.map(p => ({
  to: p.push_token,
  title: '🔔 FAF Notifications are Live!',
  body: 'You\'ll now get real-time notifications for messages, likes, follows & more — even when the app is closed.',
  sound: 'default',
  channelId: 'default',
  data: { route: '/notifications' },
}))

// 3. Send in batches of 100 (Expo limit)
const BATCH_SIZE = 100
for (let i = 0; i < messages.length; i += BATCH_SIZE) {
  const batch = messages.slice(i, i + BATCH_SIZE)
  const pushRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(batch),
  })
  const result = await pushRes.json()
  const sent = result.data?.filter(r => r.status === 'ok').length ?? 0
  const failed = result.data?.filter(r => r.status !== 'ok').length ?? 0
  console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ✅ ${sent} sent, ❌ ${failed} failed`)
}

console.log('Broadcast complete!')
