import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';

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
  },
  API: {
    GraphQL: {
      endpoint: 'https://dummy-endpoint.appsync-api.us-east-1.amazonaws.com/graphql',
      region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
      defaultAuthMode: 'userPool'
    }
  }
});

// The generated client for AppSync
export const client: any = generateClient({ authMode: 'userPool' });

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
    next: ({ data }: { data: any }) => {
      if (data?.onRealtimeEvent) {
        try {
          const payload = JSON.parse(data.onRealtimeEvent.payload);
          callback(data.onRealtimeEvent.event, payload);
        } catch {
          // ignore parsing error
        }
      }
    },
    error: (err: any) => console.error('Subscription error:', err)
  });
  return sub;
}
