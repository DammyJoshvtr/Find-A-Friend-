/**
 * lib/academic.ts
 * Academic hub: courses, enrollments, study groups, resources, discussions.
 *
 * Courses are admin-seeded. Students enroll in courses they take.
 * Study groups are student-created, optionally linked to a course.
 * Resources in the `academic-resources` bucket are private — accessed via
 * 1-hour signed URLs. The download count is incremented atomically via RPC.
 */
import { supabase } from './supabase'
import { uploadFile } from './upload'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Course {
  id: string
  code: string
  name: string
  department: string | null
  level: string | null
  semester: string | null
  created_at: string
  // Client-derived
  is_enrolled?: boolean
}

export interface StudyGroup {
  id: string
  course_id: string | null
  name: string
  description: string | null
  venue: string | null
  meet_time: string | null
  is_recurring: boolean
  max_members: number | null
  member_count: number
  created_by: string
  created_at: string
  courses?: Pick<Course, 'id' | 'code' | 'name'> | null
  profiles?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
  // Client-derived
  is_member?: boolean
}

export type ResourceType = 'note' | 'past_question' | 'textbook' | 'slide' | 'other'

export interface AcademicResource {
  id: string
  course_id: string | null
  uploader_id: string
  title: string
  description: string | null
  file_url: string
  file_type: string
  file_size_kb: number | null
  resource_type: ResourceType
  download_count: number
  created_at: string
  courses?: Pick<Course, 'id' | 'code' | 'name'> | null
  profiles?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface CourseDiscussion {
  id: string
  course_id: string
  author_id: string
  body: string
  parent_id: string | null
  created_at: string
  profiles?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
  replies?: CourseDiscussion[]
}

export interface CreateStudyGroupPayload {
  courseId?: string
  name: string
  description?: string
  venue?: string
  meetTime?: string
  isRecurring?: boolean
  maxMembers?: number
}

export interface UploadResourcePayload {
  courseId?: string
  title: string
  description?: string
  fileUri: string
  fileName: string
  mimeType: string
  fileSizeKb?: number
  resourceType?: ResourceType
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function getCourses(filters?: {
  department?: string
  level?: string
  search?: string
}): Promise<{ data: Course[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('courses')
      .select('*')
      .order('code', { ascending: true })

    if (filters?.department) {
      query = query.eq('department', filters.department)
    }
    if (filters?.level) {
      query = query.eq('level', filters.level)
    }
    if (filters?.search) {
      query = query.or(
        `code.ilike.%${filters.search}%,name.ilike.%${filters.search}%`
      )
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as Course[], error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getMyEnrolledCourses(): Promise<{
  data: Course[] | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('course_enrollments')
      .select('courses(*)')
      .eq('user_id', user.id)

    if (error) throw error
    const courses = (data ?? [])
      .map((r: any) => r.courses)
      .filter(Boolean) as Course[]
    return { data: courses, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function enrollInCourse(courseId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('course_enrollments')
      .insert({ course_id: courseId, user_id: user.id })

    if (error && error.code !== '23505') throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function unenrollFromCourse(courseId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('course_enrollments')
      .delete()
      .eq('course_id', courseId)
      .eq('user_id', user.id)

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Study Groups
// ---------------------------------------------------------------------------

export async function getStudyGroups(courseId?: string): Promise<{
  data: StudyGroup[] | null
  error: Error | null
}> {
  try {
    let query = supabase
      .from('study_groups')
      .select('*')
      .order('created_at', { ascending: false })

    if (courseId) {
      query = query.eq('course_id', courseId)
    }

    const { data: sgData, error } = await query
    if (error) throw error

    let hydrated = (sgData as StudyGroup[]) ?? []
    if (hydrated.length > 0) {
      const uids = [...new Set(hydrated.map(sg => sg.created_by))]
      const cids = [...new Set(hydrated.map(sg => sg.course_id).filter(Boolean))] as string[]
      
      const [pRes, cRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', uids),
        cids.length > 0 ? supabase.from('courses').select('id, code, name').in('id', cids) : { data: [] }
      ])
      
      const pMap = new Map(pRes.data?.map(p => [p.id, p]) ?? [])
      const cMap = new Map(cRes.data?.map(c => [c.id, c]) ?? [])
      
      hydrated = hydrated.map(sg => ({
        ...sg,
        profiles: pMap.get(sg.created_by) ?? null,
        courses: sg.course_id ? cMap.get(sg.course_id) ?? null : null
      }))
    }
    return { data: hydrated, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function createStudyGroup(payload: CreateStudyGroupPayload): Promise<{
  data: StudyGroup | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('study_groups')
      .insert({
        created_by: user.id,
        course_id: payload.courseId ?? null,
        name: payload.name,
        description: payload.description ?? null,
        venue: payload.venue ?? null,
        meet_time: payload.meetTime ?? null,
        is_recurring: payload.isRecurring ?? false,
        max_members: payload.maxMembers ?? null,
      })
      .select('*, courses(id, code, name), profiles!created_by(id, full_name, avatar_url)')
      .single()

    if (error) throw error

    // Auto-join the creator
    await supabase
      .from('study_group_members')
      .insert({ group_id: data.id, user_id: user.id })

    return { data: data as StudyGroup, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function joinStudyGroup(groupId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check max_members constraint
    const { data: group } = await supabase
      .from('study_groups')
      .select('max_members, member_count')
      .eq('id', groupId)
      .single()

    if (group?.max_members && group.member_count >= group.max_members) {
      throw new Error('This study group is full')
    }

    const { error } = await supabase
      .from('study_group_members')
      .insert({ group_id: groupId, user_id: user.id })

    if (error && error.code !== '23505') throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function leaveStudyGroup(groupId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('study_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id)

    if (error) throw error
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Academic Resources
// ---------------------------------------------------------------------------

export async function getResources(filters?: {
  courseId?: string
  resourceType?: ResourceType
  search?: string
}): Promise<{ data: AcademicResource[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('academic_resources')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.courseId) {
      query = query.eq('course_id', filters.courseId)
    }
    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType)
    }
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`)
    }

    const { data: rData, error } = await query
    if (error) throw error

    let hydrated = (rData as AcademicResource[]) ?? []
    if (hydrated.length > 0) {
      const uids = [...new Set(hydrated.map(r => r.uploader_id))]
      const cids = [...new Set(hydrated.map(r => r.course_id).filter(Boolean))] as string[]
      
      const [pRes, cRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', uids),
        cids.length > 0 ? supabase.from('courses').select('id, code, name').in('id', cids) : { data: [] }
      ])
      
      const pMap = new Map(pRes.data?.map(p => [p.id, p]) ?? [])
      const cMap = new Map(cRes.data?.map(c => [c.id, c]) ?? [])
      
      hydrated = hydrated.map(r => ({
        ...r,
        profiles: pMap.get(r.uploader_id) ?? null,
        courses: r.course_id ? cMap.get(r.course_id) ?? null : null
      }))
    }
    return { data: hydrated, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Uploads a file to the `academic-resources` private bucket and inserts
 * a metadata row in `academic_resources`.
 */
export async function uploadResource(payload: UploadResourcePayload): Promise<{
  data: AcademicResource | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const ext = payload.fileName.split('.').pop() ?? 'pdf'
    const storagePath = `${user.id}/${Date.now()}_${payload.fileName}`

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const formData = new FormData()
    formData.append('file', { uri: payload.fileUri, name: payload.fileName, type: payload.mimeType } as any)

    const uploadRes = await fetch(
      `https://vcbtvhociaioeyhhsczh.supabase.co/storage/v1/object/academic-resources/${storagePath}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'x-upsert': 'false' },
        body: formData,
      }
    )
    if (!uploadRes.ok) {
      const msg = await uploadRes.text().catch(() => uploadRes.status.toString())
      throw new Error(`Upload failed: ${msg}`)
    }

    // For private bucket, store the storage path (signed URLs generated on demand)
    const { data, error: insertError } = await supabase
      .from('academic_resources')
      .insert({
        uploader_id: user.id,
        course_id: payload.courseId ?? null,
        title: payload.title,
        description: payload.description ?? null,
        file_url: storagePath,
        file_type: ext,
        file_size_kb: payload.fileSizeKb ?? null,
        resource_type: payload.resourceType ?? 'note',
      })
      .select('*')
      .single()

    if (insertError) throw insertError
    return { data: data as AcademicResource, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Returns a 1-hour signed URL for a private academic resource.
 * Also increments the download count via RPC.
 */
export async function getResourceSignedUrl(
  resource: AcademicResource,
  expiresInSeconds = 3600
): Promise<{ data: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from('academic-resources')
      .createSignedUrl(resource.file_url, expiresInSeconds)

    if (error) throw error

    // Increment download counter (fire-and-forget, non-blocking)
    supabase.rpc('increment_resource_download', {
      p_resource_id: resource.id,
    }).then(() => {})

    return { data: data.signedUrl, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Course Discussions
// ---------------------------------------------------------------------------

export async function getCourseDiscussions(courseId: string): Promise<{
  data: CourseDiscussion[] | null
  error: Error | null
}> {
  try {
    const { data: dData, error } = await supabase
      .from('course_discussions')
      .select('*')
      .eq('course_id', courseId)
      .is('parent_id', null)       // top-level only
      .order('created_at', { ascending: false })

    if (error) throw error
    
    let hydrated = (dData as CourseDiscussion[]) ?? []
    if (hydrated.length > 0) {
      const uids = [...new Set(hydrated.map(d => d.author_id))]
      const { data: pData } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', uids)
      const pMap = new Map(pData?.map(p => [p.id, p]) ?? [])
      hydrated = hydrated.map(d => ({ ...d, profiles: pMap.get(d.author_id) ?? null }))
    }
    return { data: hydrated, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getDiscussionReplies(parentId: string): Promise<{
  data: CourseDiscussion[] | null
  error: Error | null
}> {
  try {
    const { data: dData, error } = await supabase
      .from('course_discussions')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true })

    if (error) throw error
    
    let hydrated = (dData as CourseDiscussion[]) ?? []
    if (hydrated.length > 0) {
      const uids = [...new Set(hydrated.map(d => d.author_id))]
      const { data: pData } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', uids)
      const pMap = new Map(pData?.map(p => [p.id, p]) ?? [])
      hydrated = hydrated.map(d => ({ ...d, profiles: pMap.get(d.author_id) ?? null }))
    }
    return { data: hydrated, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function createAcademicPost(
  courseId: string,
  body: string,
  parentId?: string
): Promise<{ data: CourseDiscussion | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('course_discussions')
      .insert({
        course_id: courseId,
        author_id: user.id,
        body,
        parent_id: parentId ?? null,
      })
      .select('*')
      .single()

    if (error) throw error
    
    // Fetch profile for the new post
    const { data: pData } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', data.author_id).single()
    const hydrated = { ...data, profiles: pData ?? null }
    
    return { data: hydrated as CourseDiscussion, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Study Group Chat & Resource helpers
// ---------------------------------------------------------------------------

export async function getMyJoinedStudyGroups(): Promise<{
  data: string[] | null
  error: Error | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: null }

    const { data, error } = await supabase
      .from('study_group_members')
      .select('group_id')
      .eq('user_id', user.id)

    if (error) throw error
    return { data: (data ?? []).map((r: any) => r.group_id), error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getStudyGroupMessages(groupId: string): Promise<{
  data: any[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('study_group_messages')
      .select('*, profiles!sender_id(id, full_name, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function sendStudyGroupMessage(
  groupId: string,
  body: string
): Promise<{ data: any | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('study_group_messages')
      .insert({ group_id: groupId, sender_id: user.id, body })
      .select('*, profiles!sender_id(id, full_name, avatar_url)')
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getResourceDetail(id: string): Promise<{
  data: AcademicResource | null
  error: Error | null
}> {
  try {
    const { data, error } = await supabase
      .from('academic_resources')
      .select('*, courses(id, code, name), profiles!uploader_id(id, full_name, avatar_url)')
      .eq('id', id)
      .single()

    if (error) throw error
    return { data: data as AcademicResource, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
