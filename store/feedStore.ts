/**
 * store/feedStore.ts
 * Zustand store for the social feed.
 *
 * Responsibilities:
 * - Holds the paginated post list in memory
 * - Tracks optimistic like state so the heart icon flips instantly
 * - Exposes `loadFeed` (initial), `loadMore` (pagination), and `refresh`
 * - After a successful like/unlike RPC the store updates the relevant post
 *   in-place without re-fetching the whole feed
 */
import { create } from 'zustand'
import { getFeed, likePost, getMyLikedPostIds } from '../lib/feed'
import type { FeedPost } from '../lib/feed'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface FeedState {
  posts: FeedPost[]
  loading: boolean
  refreshing: boolean
  hasMore: boolean
  /** cursor = created_at of the oldest loaded post */
  cursor: string | null
  /** Set of post IDs the current user has liked (hydrated on load) */
  likedPostIds: Set<string>
  error: string | null

  // Actions
  loadFeed: () => Promise<void>
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  toggleLike: (postId: string) => Promise<void>
  /**
   * Called when a new post INSERT arrives via realtime subscription.
   * Prepends the post to the top of the list.
   */
  prependPost: (post: FeedPost) => void
  /**
   * Increments comment count locally after the user posts a comment,
   * so the counter updates without re-fetching.
   */
  incrementCommentCount: (postId: string) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  loading: false,
  refreshing: false,
  hasMore: true,
  cursor: null,
  likedPostIds: new Set(),
  error: null,

  // -------------------------------------------------------------------------
  // Initial load
  // -------------------------------------------------------------------------
  loadFeed: async () => {
    if (get().loading) return
    set({ loading: true, error: null })

    try {
      const { data, error } = await getFeed(undefined, 20)
      if (error) throw error

      const posts = data ?? []
      const postIds = posts.map(p => p.id)
      const likedIds = await getMyLikedPostIds(postIds)
      const likedSet = new Set(likedIds)

      // Hydrate is_liked field
      const hydratedPosts = posts.map(p => ({
        ...p,
        is_liked: likedSet.has(p.id),
      }))

      set({
        posts: hydratedPosts,
        likedPostIds: likedSet,
        cursor: posts.length > 0 ? posts[posts.length - 1].created_at : null,
        hasMore: posts.length === 20,
        loading: false,
      })
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  // -------------------------------------------------------------------------
  // Pull-to-refresh
  // -------------------------------------------------------------------------
  refresh: async () => {
    set({ refreshing: true, error: null })

    try {
      const { data, error } = await getFeed(undefined, 20)
      if (error) throw error

      const posts = data ?? []
      const likedIds = await getMyLikedPostIds(posts.map(p => p.id))
      const likedSet = new Set(likedIds)

      const hydratedPosts = posts.map(p => ({
        ...p,
        is_liked: likedSet.has(p.id),
      }))

      set({
        posts: hydratedPosts,
        likedPostIds: likedSet,
        cursor: posts.length > 0 ? posts[posts.length - 1].created_at : null,
        hasMore: posts.length === 20,
        refreshing: false,
      })
    } catch (err) {
      set({ refreshing: false, error: (err as Error).message })
    }
  },

  // -------------------------------------------------------------------------
  // Infinite scroll
  // -------------------------------------------------------------------------
  loadMore: async () => {
    const { loading, hasMore, cursor } = get()
    if (loading || !hasMore || !cursor) return

    set({ loading: true })

    try {
      const { data, error } = await getFeed(cursor, 20)
      if (error) throw error

      const newPosts = data ?? []
      const likedIds = await getMyLikedPostIds(newPosts.map(p => p.id))
      const newLikedIds = new Set([...get().likedPostIds, ...likedIds])

      const hydratedPosts = newPosts.map(p => ({
        ...p,
        is_liked: newLikedIds.has(p.id),
      }))

      set(state => ({
        posts: [...state.posts, ...hydratedPosts],
        likedPostIds: newLikedIds,
        cursor: newPosts.length > 0 ? newPosts[newPosts.length - 1].created_at : state.cursor,
        hasMore: newPosts.length === 20,
        loading: false,
      }))
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  // -------------------------------------------------------------------------
  // Optimistic like toggle
  // -------------------------------------------------------------------------
  toggleLike: async (postId: string) => {
    const { likedPostIds } = get()
    const isCurrentlyLiked = likedPostIds.has(postId)

    // 1. Optimistic update — flip the state immediately
    set(state => {
      const newLikedIds = new Set(state.likedPostIds)
      if (isCurrentlyLiked) {
        newLikedIds.delete(postId)
      } else {
        newLikedIds.add(postId)
      }

      const updatedPosts = state.posts.map(p => {
        if (p.id !== postId) return p
        return {
          ...p,
          is_liked: !isCurrentlyLiked,
          likes_count: isCurrentlyLiked
            ? Math.max(0, p.likes_count - 1)
            : p.likes_count + 1,
        }
      })

      return { posts: updatedPosts, likedPostIds: newLikedIds }
    })

    // 2. Server call
    const { data, error } = await likePost(postId)

    // 3. Rollback on error or reconcile server truth
    if (error || !data) {
      set(state => {
        const rolledBack = new Set(state.likedPostIds)
        if (isCurrentlyLiked) {
          rolledBack.add(postId)
        } else {
          rolledBack.delete(postId)
        }

        const rolledBackPosts = state.posts.map(p => {
          if (p.id !== postId) return p
          return {
            ...p,
            is_liked: isCurrentlyLiked,
            likes_count: isCurrentlyLiked
              ? p.likes_count + 1
              : Math.max(0, p.likes_count - 1),
          }
        })

        return { posts: rolledBackPosts, likedPostIds: rolledBack }
      })
    } else {
      // Server returned the authoritative liked state — reconcile if needed
      set(state => {
        const serverLiked: boolean = data.liked
        const newLikedIds = new Set(state.likedPostIds)
        if (serverLiked) {
          newLikedIds.add(postId)
        } else {
          newLikedIds.delete(postId)
        }

        const reconciled = state.posts.map(p => {
          if (p.id !== postId) return p
          // Keep our optimistic count unless it diverged from server state
          const wasWrong = serverLiked === isCurrentlyLiked
          if (wasWrong) {
            // The server result matched the original state — our optimistic update was wrong
            return {
              ...p,
              is_liked: serverLiked,
              likes_count: serverLiked
                ? p.likes_count + 1
                : Math.max(0, p.likes_count - 1),
            }
          }
          return { ...p, is_liked: serverLiked }
        })

        return { posts: reconciled, likedPostIds: newLikedIds }
      })
    }
  },

  // -------------------------------------------------------------------------
  // Realtime: new post arrived
  // -------------------------------------------------------------------------
  prependPost: (post: FeedPost) => {
    set(state => ({
      posts: [post, ...state.posts],
    }))
  },

  // -------------------------------------------------------------------------
  // Comment count bump
  // -------------------------------------------------------------------------
  incrementCommentCount: (postId: string) => {
    set(state => ({
      posts: state.posts.map(p =>
        p.id === postId
          ? { ...p, comments_count: p.comments_count + 1 }
          : p
      ),
    }))
  },
}))
