import { create } from 'zustand'
import type { Course, StudyGroup, AcademicResource, ResourceType } from '../lib/academic'
import { getCourses, getMyEnrolledCourses, getStudyGroups, getResources } from '../lib/academic'

interface AcademicState {
  courses: Course[]
  coursesNextToken: string | null
  loadingCourses: boolean

  enrolledCourses: Course[]
  loadingEnrolled: boolean

  groups: StudyGroup[]
  groupsNextToken: string | null
  loadingGroups: boolean

  resources: AcademicResource[]
  resourcesNextToken: string | null
  loadingResources: boolean

  // Filters
  resourceTypeFilter: ResourceType | 'all'
  searchQuery: string

  // Actions
  setResourceTypeFilter: (filter: ResourceType | 'all') => void
  setSearchQuery: (query: string) => void

  fetchCourses: (reset?: boolean) => Promise<void>
  fetchEnrolledCourses: () => Promise<void>
  fetchGroups: (reset?: boolean) => Promise<void>
  fetchResources: (reset?: boolean) => Promise<void>

  optimisticJoinGroup: (groupId: string) => void
  optimisticLeaveGroup: (groupId: string) => void
}

export const useAcademicStore = create<AcademicState>((set, get) => ({
  courses: [],
  coursesNextToken: null,
  loadingCourses: false,

  enrolledCourses: [],
  loadingEnrolled: false,

  groups: [],
  groupsNextToken: null,
  loadingGroups: false,

  resources: [],
  resourcesNextToken: null,
  loadingResources: false,

  resourceTypeFilter: 'all',
  searchQuery: '',

  setResourceTypeFilter: (filter) => set({ resourceTypeFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  fetchCourses: async (reset = false) => {
    const state = get()
    if (state.loadingCourses) return
    if (!reset && !state.coursesNextToken && state.courses.length > 0) return

    set({ loadingCourses: true })
    try {
      const token = reset ? undefined : state.coursesNextToken ?? undefined
      const { data, nextToken, error } = await getCourses({ search: state.searchQuery, nextToken: token })
      if (error) throw error

      set({
        courses: reset ? (data ?? []) : [...state.courses, ...(data ?? [])],
        coursesNextToken: nextToken,
      })
    } catch (e) {
      console.error('fetchCourses error:', e)
      throw e
    } finally {
      set({ loadingCourses: false })
    }
  },

  fetchEnrolledCourses: async () => {
    set({ loadingEnrolled: true })
    try {
      const { data, error } = await getMyEnrolledCourses()
      if (error) throw error
      set({ enrolledCourses: data ?? [] })
    } catch (e) {
      console.error('fetchEnrolledCourses error:', e)
    } finally {
      set({ loadingEnrolled: false })
    }
  },

  fetchGroups: async (reset = false) => {
    const state = get()
    if (state.loadingGroups) return
    if (!reset && !state.groupsNextToken && state.groups.length > 0) return

    set({ loadingGroups: true })
    try {
      const token = reset ? undefined : state.groupsNextToken ?? undefined
      const { data, nextToken, error } = await getStudyGroups(undefined, token)
      if (error) throw error

      set({
        groups: reset ? (data ?? []) : [...state.groups, ...(data ?? [])],
        groupsNextToken: nextToken,
      })
    } catch (e) {
      console.error('fetchGroups error:', e)
      throw e
    } finally {
      set({ loadingGroups: false })
    }
  },

  fetchResources: async (reset = false) => {
    const state = get()
    if (state.loadingResources) return
    if (!reset && !state.resourcesNextToken && state.resources.length > 0) return

    set({ loadingResources: true })
    try {
      const token = reset ? undefined : state.resourcesNextToken ?? undefined
      const rType = state.resourceTypeFilter === 'all' ? undefined : state.resourceTypeFilter
      const { data, nextToken, error } = await getResources({ search: state.searchQuery, resourceType: rType, nextToken: token })
      if (error) throw error

      set({
        resources: reset ? (data ?? []) : [...state.resources, ...(data ?? [])],
        resourcesNextToken: nextToken,
      })
    } catch (e) {
      console.error('fetchResources error:', e)
      throw e
    } finally {
      set({ loadingResources: false })
    }
  },

  optimisticJoinGroup: (groupId) => {
    set((state) => ({
      groups: state.groups.map(g => 
        g.id === groupId 
          ? { ...g, is_member: true, member_count: (g.member_count ?? 0) + 1 }
          : g
      )
    }))
  },

  optimisticLeaveGroup: (groupId) => {
    set((state) => ({
      groups: state.groups.map(g => 
        g.id === groupId 
          ? { ...g, is_member: false, member_count: Math.max(0, (g.member_count ?? 0) - 1) }
          : g
      )
    }))
  }
}))
