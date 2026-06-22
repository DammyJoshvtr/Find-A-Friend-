/**
 * client/supabase-cognito-adapter.ts
 *
 * A compatibility adapter that wraps the Supabase client's auth methods
 * and redirects them to AWS Cognito User Pools.
 *
 * This allows the React Native client to continue using:
 *   - supabase.auth.signUp()
 *   - supabase.auth.signInWithPassword()
 *   - supabase.auth.signOut()
 *   - supabase.auth.getUser()
 *   - supabase.auth.getSession()
 *   - supabase.auth.onAuthStateChange()
 *
 * While routing authentication to AWS Cognito, and storing/refreshing Cognito JWTs.
 * The Cognito ID Token is automatically passed to the ECS PostgREST backend
 * as the Bearer token, authorizing database queries.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const AWS_REGION = process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1';
const COGNITO_CLIENT_ID = process.env.EXPO_PUBLIC_AWS_COGNITO_CLIENT_ID!;
const COGNITO_USER_POOL_ID = process.env.EXPO_PUBLIC_AWS_COGNITO_USER_POOL_ID!;
const API_URL = process.env.EXPO_PUBLIC_API_URL!; // Points to AWS Application Load Balancer

const STORAGE_KEY = 'faf-cognito-session';

// Cognito Action Dispatcher using native Fetch to avoid heavy/crashy SDKs
async function callCognito(action: string, body: object) {
  const response = await fetch(`https://cognito-idp.${AWS_REGION}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.__type || 'Cognito request failed');
  }
  return data;
}

export class CognitoAuthAdapter {
  private listeners: Array<(event: string, session: any) => void> = [];
  private currentSession: any = null;

  constructor() {
    this.loadSessionFromStorage();
  }

  private async loadSessionFromStorage() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.currentSession = JSON.parse(stored);
        this.triggerListeners('SIGNED_IN', this.currentSession);
      }
    } catch (err) {
      console.error('Failed to load session from storage', err);
    }
  }

  private async saveSessionToStorage(session: any) {
    this.currentSession = session;
    try {
      if (session) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.error('Failed to save session to storage', err);
    }
  }

  private triggerListeners(event: string, session: any) {
    this.listeners.forEach((listener) => listener(event, session));
  }

  async signUp({ email, password, options }: any) {
    try {
      const formattedEmail = email.toLowerCase().trim();
      const res = await callCognito('SignUp', {
        ClientId: COGNITO_CLIENT_ID,
        Username: formattedEmail,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: formattedEmail },
          { Name: 'name', Value: options?.data?.full_name || options?.data?.name || '' },
        ],
      });

      return {
        data: {
          user: {
            id: res.UserSub,
            email: formattedEmail,
          },
          session: null, // User is not logged in yet (needs confirmation or signing in)
        },
        error: null,
      };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: err };
    }
  }

  async signInWithPassword({ email, password }: any) {
    try {
      // Clear any existing session before starting a new sign in
      await this.saveSessionToStorage(null);
      this.triggerListeners('SIGNED_OUT', null);

      const formattedEmail = email.toLowerCase().trim();
      const res = await callCognito('InitiateAuth', {
        ClientId: COGNITO_CLIENT_ID,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: formattedEmail,
          PASSWORD: password,
        },
      });

      const authResult = res.AuthenticationResult;

      // Fetch user profile attributes to build user object
      const userRes = await callCognito('GetUser', {
        AccessToken: authResult.AccessToken,
      });

      const emailAttr = userRes.UserAttributes.find((a: any) => a.Name === 'email')?.Value;
      const nameAttr = userRes.UserAttributes.find((a: any) => a.Name === 'name')?.Value;
      const legacyIdAttr = userRes.UserAttributes.find((a: any) => a.Name === 'custom:legacy_id')?.Value;

      const user = {
        id: legacyIdAttr || userRes.Username, // Map back to original DB ID if migrated, else cognito sub
        email: emailAttr || formattedEmail,
        user_metadata: {
          full_name: nameAttr || '',
        },
      };

      const session = {
        access_token: authResult.IdToken, // ID Token contains the standard claims for authentication
        refresh_token: authResult.RefreshToken,
        user,
        expires_at: Math.floor(Date.now() / 1000) + authResult.ExpiresIn,
      };

      await this.saveSessionToStorage(session);
      this.triggerListeners('SIGNED_IN', session);

      return { data: { session, user }, error: null };
    } catch (err: any) {
      return { data: { session: null, user: null }, error: err };
    }
  }

  async signOut() {
    try {
      if (this.currentSession?.refresh_token) {
        // If we want to revoke Cognito tokens:
        // callCognito('GlobalSignOut', { AccessToken: ... })
      }
    } catch (err) {
      console.warn('Cognito global signout warning:', err);
    } finally {
      await this.saveSessionToStorage(null);
      this.triggerListeners('SIGNED_OUT', null);
    }
    return { error: null };
  }

  async getSession() {
    // Check if session is expired, and if so, perform a refresh token grant
    if (this.currentSession && this.currentSession.expires_at < Date.now() / 1000) {
      await this.refreshCognitoSession();
    }
    return { data: { session: this.currentSession }, error: null };
  }

  async getUser() {
    const { data: { session } } = await this.getSession();
    return { data: { user: session?.user || null }, error: null };
  }

  private async refreshCognitoSession() {
    try {
      if (!this.currentSession?.refresh_token) throw new Error('No refresh token');

      const res = await callCognito('InitiateAuth', {
        ClientId: COGNITO_CLIENT_ID,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: this.currentSession.refresh_token,
        },
      });

      const authResult = res.AuthenticationResult;
      const refreshedSession = {
        ...this.currentSession,
        access_token: authResult.IdToken,
        expires_at: Math.floor(Date.now() / 1000) + authResult.ExpiresIn,
      };

      await this.saveSessionToStorage(refreshedSession);
      this.triggerListeners('TOKEN_REFRESHED', refreshedSession);
    } catch (err) {
      console.error('Cognito Token refresh failed, signing out:', err);
      await this.signOut();
    }
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.listeners.push(callback);
    // Trigger initial callback with current session
    callback(this.currentSession ? 'SIGNED_IN' : 'SIGNED_OUT', this.currentSession);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter((l) => l !== callback);
          },
        },
      },
    };
  }
}

// Create the migrated client instance
const cognitoAuth = new CognitoAuthAdapter();

// Initialize the SupabaseClient pointing to the ECS PostgREST service
const baseSupabase = createClient(API_URL, 'aws-anonymous-key', {
  auth: {
    persistSession: false, // Managed by CognitoAuthAdapter
    autoRefreshToken: false,
  },
  global: {
    fetch: async (url, options) => {
      const { data: { session } } = await cognitoAuth.getSession();
      const headers = new Headers(options?.headers || {});
      
      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
      } else {
        headers.delete('Authorization');
      }
      
      try {
        // Strip the '/rest/v1' prefix because the AWS ALB/ECS PostgREST service
        // is mapped directly to the root path (/).
        const targetUrl = url.toString().replace(`${API_URL}/rest/v1`, API_URL);
        console.log('[Supabase Fetch] Attempting URL:', targetUrl);
        const res = await fetch(targetUrl, {
          ...options,
          headers,
        });
        console.log('[Supabase Fetch] Status code:', res.status, 'for:', targetUrl);
        if (!res.ok) {
          try {
            const body = await res.clone().text();
            console.log('[Supabase Fetch] Response error body:', body);
          } catch (_) {}
        }
        return res;
      } catch (err: any) {
        console.error('[Supabase Fetch] Network/TLS Error:', err?.message || err, 'Stack:', err?.stack);
        throw err;
      }
    },
  },
});

// Proxy the Supabase Client so auth methods are routed to Cognito.
// Database and storage requests are automatically authorized via the global.fetch interceptor.
export const supabase = new Proxy(baseSupabase, {
  get(target, prop, receiver) {
    if (prop === 'auth') {
      return cognitoAuth;
    }
    return Reflect.get(target, prop, receiver);
  },
});

export default supabase;
