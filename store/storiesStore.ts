/**
 * store/storiesStore.ts
 * Zustand store for stories.
 *
 * Responsibilities:
 * - Caches story groups from the DB
 * - Tracks which stories the current user has viewed (persisted in MMKV)
 * - Prunes stories older than 24 hours from the local cache on load
 * - Exposes `currentGroup` / `currentIndex` for the story viewer screen
 */
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getStories, markStoryViewed } from '../lib/stories'
import type { Story, StoryGroup } from '../lib/stories'

const VIEWED_KEY = 'stories:viewed_ids'

// In-memory cache so synchronous reads work after first async load
let _viewedCache: Set<string> = new Set()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadViewedIds(): Set<string> {
  return _viewedCache
}

async function loadViewedIdsAsync(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(VIEWED_KEY)
    const ids = raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>()
    _viewedCache = ids
    return ids
  } catch {
    return new Set()
  }
}

function saveViewedIds(ids: Set<string>): void {
  _viewedCache = ids
  AsyncStorage.setItem(VIEWED_KEY, JSON.stringify(Array.from(ids))).catch(() => {})
}

function pruneExpired(groups: StoryGroup[]): StoryGroup[] {
  const now = Date.now()
  return groups
    .map(group => ({
      ...group,
      stories: group.stories.filter(
        s => new Date(s.expires_at).getTime() > now
      ),
    }))
    .filter(group => group.stories.length > 0)
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface StoriesState {
  groups: StoryGroup[]
  loading: boolean
  error: string | null

  /** Persisted set of story IDs the user has viewed */
  viewedIds: Set<string>

  /** Story viewer state — which group/index is currently open */
  viewerGroupId: string | null
  viewerIndex: number

  // Actions
  loadStories: () => Promise<void>
  markViewed: (storyId: string) => Promise<void>
  pruneLocalExpired: () => void

  /** Open the story viewer for a specific author */
  openViewer: (authorId: string, index?: number) => void
  /** Advance to the next story or group */
  advanceViewer: () => void
  /** Close story viewer */
  closeViewer: () => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStoriesStore = create<StoriesState>((set, get) => ({
  groups: [],
  loading: false,
  error: null,
  viewedIds: loadViewedIds(),
  viewerGroupId: null,
  viewerIndex: 0,

  // -------------------------------------------------------------------------
  // Load stories from DB
  // -------------------------------------------------------------------------
  loadStories: async () => {
    set({ loading: true, error: null })

    try {
      const [{ data, error }, viewedIds] = await Promise.all([
        getStories(),
        loadViewedIdsAsync(),
      ])
      if (error) throw error

      const rawGroups = data ?? []

      // Prune expired and re-apply viewed state
      const pruned = pruneExpired(rawGroups).map(group => ({
        ...group,
        all_viewed: group.stories.every(s => viewedIds.has(s.id)),
      }))

      set({ groups: pruned, viewedIds, loading: false })
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  // -------------------------------------------------------------------------
  // Mark a story viewed (optimistic + server persist)
  // -------------------------------------------------------------------------
  markViewed: async (storyId: string) => {
    // Optimistic: add to local set immediately
    const newViewed = new Set(get().viewedIds)
    newViewed.add(storyId)
    saveViewedIds(newViewed)

    // Re-compute all_viewed flags for groups
    set(state => ({
      viewedIds: newViewed,
      groups: state.groups.map(group => ({
        ...group,
        all_viewed: group.stories.every(s => newViewed.has(s.id)),
      })),
    }))

    // Persist to DB (non-blocking)
    await markStoryViewed(storyId)
  },

  // -------------------------------------------------------------------------
  // Prune expired stories from local cache
  // Called on app foreground
  // -------------------------------------------------------------------------
  pruneLocalExpired: () => {
    set(state => ({
      groups: pruneExpired(state.groups),
    }))
  },

  // -------------------------------------------------------------------------
  // Story viewer controls
  // -------------------------------------------------------------------------
  openViewer: (authorId: string, index = 0) => {
    set({ viewerGroupId: authorId, viewerIndex: index })
  },

  advanceViewer: () => {
    const { groups, viewerGroupId, viewerIndex } = get()
    const groupIdx = groups.findIndex(g => g.author_id === viewerGroupId)
    if (groupIdx === -1) {
      set({ viewerGroupId: null })
      return
    }

    const group = groups[groupIdx]
    const nextIndex = viewerIndex + 1

    if (nextIndex < group.stories.length) {
      // Move to next story in same group
      set({ viewerIndex: nextIndex })
    } else {
      // Move to next group
      const nextGroupIdx = groupIdx + 1
      if (nextGroupIdx < groups.length) {
        set({
          viewerGroupId: groups[nextGroupIdx].author_id,
          viewerIndex: 0,
        })
      } else {
        // End of all stories
        set({ viewerGroupId: null, viewerIndex: 0 })
      }
    }
  },

  closeViewer: () => {
    set({ viewerGroupId: null, viewerIndex: 0 })
  },
}))

// ---------------------------------------------------------------------------
// Selectors (derived state helpers)
// ---------------------------------------------------------------------------

/** Returns the current Story being viewed, or null if viewer is closed */
export function selectCurrentStory(state: StoriesState): Story | null {
  if (!state.viewerGroupId) return null
  const group = state.groups.find(g => g.author_id === state.viewerGroupId)
  if (!group) return null
  return group.stories[state.viewerIndex] ?? null
}

/** Returns the current StoryGroup being viewed */
export function selectCurrentGroup(state: StoriesState): StoryGroup | null {
  if (!state.viewerGroupId) return null
  return state.groups.find(g => g.author_id === state.viewerGroupId) ?? null
}
