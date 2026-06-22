import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';


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

function decodeBase64(str: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = str.replace(/[^A-Za-z0-9+/]/g, '');
  for (let i = 0, bc = 0, bs = 0; i < str.length; i++) {
    const char = str.charAt(i);
    const idx = chars.indexOf(char);
    if (idx === -1) continue;
    bs = bc % 4 ? (bs << 6) + idx : idx;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
  }
  return output;
}

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = decodeBase64(base64);
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

// Holds the Cognito AccessToken for a user who is CONFIRMED but has
// email_verified=false. Used to call GetUserAttributeVerificationCode /
// VerifyUserAttribute instead of the new-user ConfirmSignUp APIs.
let pendingVerificationAccessToken: string | null = null;

export class CognitoAuthAdapter {
  private listeners: Array<(event: string, session: any) => void> = [];
  private currentSession: any = null;

  constructor() {
    this.loadSessionFromStorage();
  }

  private async loadSessionFromStorage() {
    // Skip on server-side rendering (web SSG/SSR) where window/AsyncStorage are unavailable
    if (typeof window === 'undefined') return;
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
      const emailVerifiedAttr = userRes.UserAttributes.find((a: any) => a.Name === 'email_verified')?.Value;

      if (emailVerifiedAttr !== 'true') {
        // Store the access token so confirmSignUp / resendConfirmationCode
        // can use VerifyUserAttribute / GetUserAttributeVerificationCode
        // (the correct APIs for already-CONFIRMED users re-verifying email).
        pendingVerificationAccessToken = authResult.AccessToken;
        // Automatically dispatch OTP to the user's email.
        try {
          await callCognito('GetUserAttributeVerificationCode', {
            AccessToken:   authResult.AccessToken,
            AttributeName: 'email',
          });
        } catch (otpErr: any) {
          console.warn('Auto OTP send failed (will show resend option):', otpErr.message);
        }
        throw new Error('UserNotConfirmedException: Please verify your email. A code has been sent to your inbox.');
      }

      const user = {
        id: legacyIdAttr || userRes.Username, // Map back to original DB ID if migrated, else cognito sub
        email: emailAttr || formattedEmail,
        email_verified: emailVerifiedAttr === 'true',
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
    
    // Auto-resolve email_verified from ID Token if missing in session user
    if (this.currentSession?.access_token && this.currentSession.user && this.currentSession.user.email_verified === undefined) {
      const payload = parseJwt(this.currentSession.access_token);
      if (payload) {
        this.currentSession.user.email_verified = payload.email_verified === true || payload.email_verified === 'true';
        await this.saveSessionToStorage(this.currentSession);
      }
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

  async resetPasswordForEmail(email: string) {
    try {
      const formattedEmail = email.toLowerCase().trim();
      await callCognito('ForgotPassword', {
        ClientId: COGNITO_CLIENT_ID,
        Username: formattedEmail,
      });
      return { data: {}, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async updateUserPassword(email: string, code: string, newPassword: string) {
    try {
      const formattedEmail = email.toLowerCase().trim();
      await callCognito('ConfirmForgotPassword', {
        ClientId: COGNITO_CLIENT_ID,
        Username: formattedEmail,
        ConfirmationCode: code,
        Password: newPassword,
      });
      return { data: {}, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async confirmSignUp(email: string, code: string) {
    try {
      const formattedEmail = email.toLowerCase().trim();

      if (pendingVerificationAccessToken) {
        // ── Re-verification path (user is CONFIRMED, email_verified=false) ──
        // Use VerifyUserAttribute with the stored access token.
        await callCognito('VerifyUserAttribute', {
          AccessToken:       pendingVerificationAccessToken,
          AttributeName:     'email',
          Code:              code,
        });
        // Clear the pending token now that verification succeeded.
        const verifiedToken = pendingVerificationAccessToken;
        pendingVerificationAccessToken = null;
        // Persist the verified flag in AsyncStorage for the onboarding badge flow.
        try {
          await AsyncStorage.setItem('verified_via_code_' + formattedEmail, 'true');
        } catch (_) {}
        // If the user already has a profile (not a new signup), upgrade badge
        // directly in the database right now.
        return { data: { accessToken: verifiedToken, isReVerify: true }, error: null };
      } else {
        // ── New-user path (UNCONFIRMED → ConfirmSignUp) ──
        await callCognito('ConfirmSignUp', {
          ClientId:         COGNITO_CLIENT_ID,
          Username:         formattedEmail,
          ConfirmationCode: code,
        });
        try {
          await AsyncStorage.setItem('verified_via_code_' + formattedEmail, 'true');
        } catch (_) {}
        return { data: { isReVerify: false }, error: null };
      }
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async resendConfirmationCode(email: string) {
    try {
      const formattedEmail = email.toLowerCase().trim();
      if (pendingVerificationAccessToken) {
        // Re-verify path: use GetUserAttributeVerificationCode
        await callCognito('GetUserAttributeVerificationCode', {
          AccessToken:   pendingVerificationAccessToken,
          AttributeName: 'email',
        });
      } else {
        // New-user path: use ResendConfirmationCode
        await callCognito('ResendConfirmationCode', {
          ClientId:  COGNITO_CLIENT_ID,
          Username:  formattedEmail,
        });
      }
      return { data: {}, error: null };
    } catch (err: any) {
      return { data: null, error: err };
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

      // The Supabase JS client appends /rest/v1/ to the base URL for all DB queries,
      // but our PostgREST instance serves tables from the root /. Strip the prefix.
      const urlStr = url.toString();
      const rewrittenUrl = API_URL ? urlStr.replace(`${API_URL}/rest/v1`, API_URL) : urlStr;
      
      return fetch(rewrittenUrl, {
        ...options,
        headers,
      });
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
