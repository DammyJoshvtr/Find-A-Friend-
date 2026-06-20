import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
// import type { Schema } from '../amplify/data/resource'; // Will be available after sandbox deploy

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_AWS_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_AWS_COGNITO_CLIENT_ID!,
      identityPoolId: '', // To be filled if using identity pools for storage
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: {
          required: true,
        },
      },
    }
  }
});

// The generated client for AppSync
export const client = generateClient<any>({ authMode: 'userPool' });

export async function broadcastEvent(channelId: string, event: string, payload: any) {
  try {
    await client.mutations.publishRealtimeEvent({
      channelId,
      event,
      payload: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Failed to broadcast event:', err);
  }
}

export function subscribeToChannel(channelId: string, callback: (event: string, payload: any) => void) {
  const sub = client.subscriptions.onRealtimeEvent({ channelId }).subscribe({
    next: ({ data }) => {
      if (data?.onRealtimeEvent) {
        try {
          const payload = JSON.parse(data.onRealtimeEvent.payload);
          callback(data.onRealtimeEvent.event, payload);
        } catch {
          // ignore parsing error
        }
      }
    },
    error: (err) => console.error('Subscription error:', err)
  });
  return sub;
}
