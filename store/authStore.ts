import { create } from 'zustand'
import { signOut as amplifySignOut, getCurrentUser, fetchAuthSession, AuthSession } from 'aws-amplify/auth'

export interface AmplifyUser {
  userId: string;
  username: string;
}

interface AuthState {
  user: AmplifyUser | null
  session: AuthSession | null
  loading: boolean
  setSession: (session: AuthSession | null, user: AmplifyUser | null) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  setSession: (session, user) =>
    set({
      session,
      user,
      loading: false,
    }),

  signOut: async () => {
    try {
      await amplifySignOut()
    } catch (err) {
      console.warn('Signout error', err)
    }
    set({ user: null, session: null, loading: false })
  },
}))