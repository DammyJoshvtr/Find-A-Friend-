/**
 * lib/search.ts
 * Global search across users, posts, hashtags, and clubs.
 */
import { client } from './aws'
import { getCurrentUser } from 'aws-amplify/auth'
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
    const { data, errors } = await client.models.profiles.list({
      filter: {
        or: [
          { full_name: { contains: query } },
          { department: { contains: query } }
        ]
      },
      limit
    })
    const error = errors ? new Error(errors[0].message) : null

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
    const { data, errors } = await client.models.posts.list({
      filter: {
        and: [
          { body: { contains: query } },
          { is_anonymous: { eq: false } }
        ]
      },
      limit
    })
    const error = errors ? new Error(errors[0].message) : null

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
    const { data, errors } = await client.models.hashtags.list({
      filter: {
        tag: { contains: query }
      },
      limit
    })
    const error = errors ? new Error(errors[0].message) : null

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
    const { data, errors } = await client.models.clubs.list({
      filter: {
        and: [
          { name: { contains: query } },
          { is_active: { eq: true } }
        ]
      },
      limit
    })
    const error = errors ? new Error(errors[0].message) : null

    if (error) throw error
    return { data: data as Club[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
