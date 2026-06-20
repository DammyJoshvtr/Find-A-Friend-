import { client } from './aws'
import { getCurrentUser } from 'aws-amplify/auth'

export async function sendConnectionRequest(receiverId: string) {
  let user;
  try { user = await getCurrentUser() } catch { return { error: 'Not logged in' } }

  const { errors } = await client.models.Connection.create({
    requester_id: user.userId,
    receiver_id: receiverId,
    status: 'pending'
  })

  if (errors && errors[0]?.message?.includes('ConditionalCheckFailedException')) return { error: "already_sent" }
  return { error: errors?.[0] }
}

export async function getMyConnections() {
  let user;
  try { user = await getCurrentUser() } catch { return [] }

  const { data, errors } = await client.models.Connection.list({
    filter: {
      or: [
        { requester_id: { eq: user.userId } },
        { receiver_id: { eq: user.userId } }
      ],
      status: { eq: 'accepted' }
    }
  })

  if (errors) return []
  return data
}

export async function checkConnectionStatus(otherUserId: string) {
  let user;
  try { user = await getCurrentUser() } catch { return null }

  const { data } = await client.models.Connection.list({
    filter: {
      or: [
        { 
          requester_id: { eq: user.userId },
          receiver_id: { eq: otherUserId }
        },
        {
          requester_id: { eq: otherUserId },
          receiver_id: { eq: user.userId }
        }
      ]
    }
  })

  return data?.[0] ?? null
}