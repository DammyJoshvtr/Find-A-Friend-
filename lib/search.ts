/**
 * lib/search.ts
 * Global search across users, posts, hashtags, and clubs.
 */
import { supabase } from './supabase'
import type { FollowProfile } from './follows'
import type { FeedPost } from './feed'
import type { Club } from './clubs'

export interface SearchHashtag {
  id: string
  tag: string
  post_count?: number
}

export async function searchUsers(query: string, limit = 20): Promise<{
  data: FollowProfile[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, department, level, avatar_url, follower_count, following_count')
      .or(`full_name.ilike.%${query}%,department.ilike.%${query}%`)
      .limit(limit)

    if (error) throw error
    return { data: data as FollowProfile[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function searchPosts(query: string, limit = 20): Promise<{
  data: FeedPost[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(id, full_name, department, level, avatar_url)')
      .ilike('body', `%${query}%`)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return { data: data as FeedPost[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function searchHashtags(query: string, limit = 20): Promise<{
  data: SearchHashtag[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('hashtags')
      .select('id, tag')
      .ilike('tag', `%${query}%`)
      .limit(limit)

    if (error) throw error
    return { data: data as SearchHashtag[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function searchClubs(query: string, limit = 20): Promise<{
  data: Club[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .ilike('name', `%${query}%`)
      .eq('is_active', true)
      .limit(limit)

    if (error) throw error
    return { data: data as Club[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
