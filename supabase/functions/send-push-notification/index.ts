import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

function buildBody(type: string, actorName: string, customBody?: string | null): string {
  if (customBody) return customBody
  switch (type) {
    case 'like':               return `${actorName} liked your post`
    case 'comment':            return `${actorName} commented on your post`
    case 'repost':             return `${actorName} reposted your post`
    case 'follow':             return `${actorName} started following you`
    case 'connection_request': return `${actorName} sent you a connection request`
    case 'event_rsvp':         return `${actorName} is attending your event`
    case 'club_announcement':  return 'New announcement in your club'
    case 'story_view':         return `${actorName} viewed your story`
    case 'mention':            return `${actorName} mentioned you in a post`
    case 'new_message':        return `${actorName} sent you a message`
    case 'feedback_comment':   return `${actorName} commented on your Campus Voice post`
    case 'feedback_upvote':    return `${actorName} upvoted your Campus Voice post`
    default:                   return 'You have a new notification'
  }
}

function buildRoute(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null
  switch (entityType) {
    case 'post':     return `/post/${entityId}`
    case 'event':    return `/event/${entityId}`
    case 'club':     return `/club/${entityId}`
    case 'feedback': return `/feedback`
    default:         return null
  }
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    // Handles both net.http_post (body is the row directly) and
    // Supabase Dashboard DB Webhooks (body has { record: {...} })
    const record = payload.record ?? payload

    if (!record?.user_id || !record?.type) {
      return new Response(JSON.stringify({ ok: false, reason: 'invalid_payload' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    // Fetch recipient's push token
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', record.user_id)
      .single()

    if (!profile?.push_token) {
      return new Response(JSON.stringify({ ok: false, reason: 'no_token' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch actor name for notification body
    let actorName = 'Someone'
    if (record.actor_id) {
      const { data: actor } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', record.actor_id)
        .single()
      if (actor?.full_name) actorName = actor.full_name
    }

    const body = buildBody(record.type, actorName, record.body)
    const route = buildRoute(record.entity_type, record.entity_id)

    const message = {
      to: profile.push_token,
      title: 'FAF',
      body,
      sound: 'default',
      channelId: 'default',
      data: {
        notificationId: record.id,
        ...(route ? { route } : {}),
        ...(record.actor_id ? { actorId: record.actor_id } : {}),
      },
    }

    const expoResp = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(message),
    })

    const result = await expoResp.json()
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
