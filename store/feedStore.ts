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
import {
  getFeed, likePost, getMyLikedPostIds,
  bookmarkPost, getMyBookmarkedPostIds,
  getFollowingFeed,
} from '../lib/feed'
import type { FeedPost } from '../lib/feed'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface FeedState {
  posts: FeedPost[]
  loading: boolean
  refreshing: boolean
  hasMore: boolean
  cursor: string | null
  likedPostIds: Set<string>
  bookmarkedPostIds: Set<string>
  activeTab: 'forYou' | 'following'
  error: string | null

  loadFeed: () => Promise<void>
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  toggleLike: (postId: string) => Promise<void>
  toggleBookmark: (postId: string) => Promise<void>
  setTab: (tab: 'forYou' | 'following') => Promise<void>
  prependPost: (post: FeedPost) => void
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
  bookmarkedPostIds: new Set(),
  activeTab: 'forYou',
  error: null,

  // -------------------------------------------------------------------------
  // Initial load
  // -------------------------------------------------------------------------
  loadFeed: async () => {
    if (get().loading) return
    set({ loading: true, error: null })

    try {
      const { activeTab } = get()
      const fetcher = activeTab === 'following' ? getFollowingFeed : getFeed
      const { data, error } = await fetcher(undefined, 20)
      if (error) throw error

      const posts = data ?? []
      const postIds = posts.map(p => p.id)
      const [likedIds, bookmarkedIds] = await Promise.all([
        getMyLikedPostIds(postIds),
        getMyBookmarkedPostIds(postIds),
      ])
      const likedSet = new Set(likedIds)
      const bookmarkedSet = new Set(bookmarkedIds)

      set({
        posts: posts.map(p => ({
          ...p,
          is_liked: likedSet.has(p.id),
          is_bookmarked: bookmarkedSet.has(p.id),
        })),
        likedPostIds: likedSet,
        bookmarkedPostIds: bookmarkedSet,
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
      const { activeTab } = get()
      const fetcher = activeTab === 'following' ? getFollowingFeed : getFeed
      const { data, error } = await fetcher(undefined, 20)
      if (error) throw error

      const posts = data ?? []
      const postIds = posts.map(p => p.id)
      const [likedIds, bookmarkedIds] = await Promise.all([
        getMyLikedPostIds(postIds),
        getMyBookmarkedPostIds(postIds),
      ])
      const likedSet = new Set(likedIds)
      const bookmarkedSet = new Set(bookmarkedIds)

      set({
        posts: posts.map(p => ({
          ...p,
          is_liked: likedSet.has(p.id),
          is_bookmarked: bookmarkedSet.has(p.id),
        })),
        likedPostIds: likedSet,
        bookmarkedPostIds: bookmarkedSet,
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
      const newIds = newPosts.map(p => p.id)
      const [likedIds, bookmarkedIds] = await Promise.all([
        getMyLikedPostIds(newIds),
        getMyBookmarkedPostIds(newIds),
      ])
      const newLikedIds = new Set([...get().likedPostIds, ...likedIds])
      const newBookmarkedIds = new Set([...get().bookmarkedPostIds, ...bookmarkedIds])

      set(state => ({
        posts: [...state.posts, ...newPosts.map(p => ({
          ...p,
          is_liked: newLikedIds.has(p.id),
          is_bookmarked: newBookmarkedIds.has(p.id),
        }))],
        likedPostIds: newLikedIds,
        bookmarkedPostIds: newBookmarkedIds,
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
          // optimistic predicted !isCurrentlyLiked; if server disagrees, revert count
          const optimisticWasWrong = serverLiked === isCurrentlyLiked
          if (optimisticWasWrong) {
            return {
              ...p,
              is_liked: serverLiked,
              likes_count: isCurrentlyLiked
                ? p.likes_count + 1          // we wrongly decremented — add back
                : Math.max(0, p.likes_count - 1), // we wrongly incremented — remove
            }
          }
          return { ...p, is_liked: serverLiked }
        })

        return { posts: reconciled, likedPostIds: newLikedIds }
      })
    }
  },

  // -------------------------------------------------------------------------
  // Optimistic bookmark toggle
  // -------------------------------------------------------------------------
  toggleBookmark: async (postId: string) => {
    const isBookmarked = get().bookmarkedPostIds.has(postId)

    set(state => {
      const ids = new Set(state.bookmarkedPostIds)
      isBookmarked ? ids.delete(postId) : ids.add(postId)
      return {
        bookmarkedPostIds: ids,
        posts: state.posts.map(p =>
          p.id === postId ? { ...p, is_bookmarked: !isBookmarked } : p
        ),
      }
    })

    const { error } = await bookmarkPost(postId)
    if (error) {
      // rollback
      set(state => {
        const ids = new Set(state.bookmarkedPostIds)
        isBookmarked ? ids.add(postId) : ids.delete(postId)
        return {
          bookmarkedPostIds: ids,
          posts: state.posts.map(p =>
            p.id === postId ? { ...p, is_bookmarked: isBookmarked } : p
          ),
        }
      })
    }
  },

  // -------------------------------------------------------------------------
  // Tab switch (reloads feed for selected tab)
  // -------------------------------------------------------------------------
  setTab: async (tab: 'forYou' | 'following') => {
    if (get().activeTab === tab) return
    set({ activeTab: tab, posts: [], cursor: null, hasMore: true })
    await get().loadFeed()
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
