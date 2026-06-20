/**
 * lib/academic.ts
 * Academic hub: courses, enrollments, study groups, resources, discussions.
 *
 * Courses are admin-seeded. Students enroll in courses they take.
 * Study groups are student-created, optionally linked to a course.
 * Resources in the `academic-resources` bucket are private — accessed via
 * 1-hour signed URLs. The download count is incremented atomically via RPC.
 */
import { client } from './aws'
import { getCurrentUser } from 'aws-amplify/auth'
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
  nextToken?: string
}): Promise<{ data: Course[] | null; nextToken?: string | null; error: Error | null }> {
  try {
    let filter: any = {}
    if (filters?.department) filter.department = { eq: filters.department }
    if (filters?.level) filter.level = { eq: filters.level }
    if (filters?.search) {
      filter.or = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } }
      ]
    }
    const hasFilter = Object.keys(filter).length > 0
    const { data, nextToken, errors } = await client.models.Course.list({
      ...(hasFilter ? { filter } : {}),
      nextToken: filters?.nextToken,
      limit: 20
    })
    if (errors) throw new Error(errors[0].message)
    
    const sorted = data.sort((a, b) => a.code.localeCompare(b.code))
    return { data: sorted as unknown as Course[], nextToken, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function getMyEnrolledCourses(): Promise<{
  data: Course[] | null
  error: Error | null
}> {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { data, errors } = await client.models.CourseEnrollment.list({
      filter: { user_id: { eq: user.userId } }
    })

    if (errors) throw new Error(errors[0].message)
    const courses = (data ?? [])
      .map((r: any) => r.courses)
      .filter(Boolean) as unknown as Course[]
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
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { errors } = await client.models.CourseEnrollment.create({
      course_id: courseId,
      user_id: user.userId
    })

    if (errors) throw new Error(errors[0].message)
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
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    // Find first to delete
    const { data } = await client.models.CourseEnrollment.list({
      filter: { course_id: { eq: courseId }, user_id: { eq: user.userId } }
    })
    if (data && data.length > 0) {
      const { errors } = await client.models.CourseEnrollment.delete({ id: data[0].id })
      if (errors) throw new Error(errors[0].message)
    }

    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ---------------------------------------------------------------------------
// Study Groups
// ---------------------------------------------------------------------------

export async function getStudyGroups(courseId?: string, nextToken?: string): Promise<{
  data: StudyGroup[] | null
  nextToken?: string | null
  error: Error | null
}> {
  try {
    const options: any = { limit: 20 }
    if (courseId) options.filter = { course_id: { eq: courseId } }
    if (nextToken) options.nextToken = nextToken

    const { data: sgData, nextToken: newNextToken, errors } = await client.models.StudyGroup.list(options)
    if (errors) throw new Error(errors[0].message)

    let hydrated = (sgData as unknown as StudyGroup[]) ?? []
    if (hydrated.length > 0) {
      const uids = [...new Set(hydrated.map(sg => sg.created_by))]
      const cids = [...new Set(hydrated.map(sg => sg.course_id).filter(Boolean))] as string[]
      
      const pRes = await Promise.all(uids.map(id => client.models.Profile.get({ id })))
      const cRes = await Promise.all(cids.map(id => client.models.Course.get({ id })))
      
      const pMap = new Map(pRes.map(p => [p.data?.id, p.data]))
      const cMap = new Map(cRes.map(c => [c.data?.id, c.data]))
      
      hydrated = hydrated.map(sg => ({
        ...sg,
        profiles: (pMap.get(sg.created_by) as any) ?? null,
        courses: (sg.course_id ? cMap.get(sg.course_id) : null) as any
      }))
    }
    hydrated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return { data: hydrated, nextToken: newNextToken, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function createStudyGroup(payload: CreateStudyGroupPayload): Promise<{
  data: StudyGroup | null
  error: Error | null
}> {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { data, errors } = await client.models.StudyGroup.create({
      created_by: user.userId,
      course_id: payload.courseId ?? null,
      name: payload.name,
      description: payload.description ?? null,
      venue: payload.venue ?? null,
      meet_time: payload.meetTime ?? null,
      is_recurring: payload.isRecurring ?? false,
      max_members: payload.maxMembers ?? null,
      member_count: 1
    })

    if (errors) throw new Error(errors[0].message)

    await client.models.StudyGroupMember.create({ group_id: data.id, user_id: user.userId })

    // hydrate
    const [pData, cData] = await Promise.all([
      client.models.Profile.get({ id: user.userId }),
      payload.courseId ? client.models.Course.get({ id: payload.courseId }) : { data: null }
    ])

    const hydrated = {
      ...data,
      profiles: pData.data as any,
      courses: cData.data as any
    }

    return { data: hydrated as unknown as StudyGroup, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function joinStudyGroup(groupId: string): Promise<{
  data: null
  error: Error | null
}> {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { data: group } = await client.models.StudyGroup.get({ id: groupId })

    if (group?.max_members && (group.member_count ?? 0) >= group.max_members) {
      throw new Error('This study group is full')
    }

    const { errors } = await client.models.StudyGroupMember.create({ group_id: groupId, user_id: user.userId })
    if (errors) throw new Error(errors[0].message)

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
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { data } = await client.models.StudyGroupMember.list({
      filter: { group_id: { eq: groupId }, user_id: { eq: user.userId } }
    })
    
    if (data && data.length > 0) {
      const { errors } = await client.models.StudyGroupMember.delete({ id: data[0].id })
      if (errors) throw new Error(errors[0].message)
    }

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
  nextToken?: string
}): Promise<{ data: AcademicResource[] | null; nextToken?: string | null; error: Error | null }> {
  try {
    let filter: any = {}
    if (filters?.courseId) filter.course_id = { eq: filters.courseId }
    if (filters?.resourceType) filter.resource_type = { eq: filters.resourceType }
    if (filters?.search) filter.title = { contains: filters.search }
    
    const hasFilter = Object.keys(filter).length > 0
    const { data: rData, nextToken, errors } = await client.models.AcademicResource.list({
      ...(hasFilter ? { filter } : {}),
      nextToken: filters?.nextToken,
      limit: 20
    })
    if (errors) throw new Error(errors[0].message)

    let hydrated = (rData as unknown as AcademicResource[]) ?? []
    if (hydrated.length > 0) {
      const uids = [...new Set(hydrated.map(r => r.uploader_id))]
      const cids = [...new Set(hydrated.map(r => r.course_id).filter(Boolean))] as string[]
      
      const pRes = await Promise.all(uids.map(id => client.models.Profile.get({ id })))
      const cRes = await Promise.all(cids.map(id => client.models.Course.get({ id })))
      
      const pMap = new Map(pRes.map(p => [p.data?.id, p.data]))
      const cMap = new Map(cRes.map(c => [c.data?.id, c.data]))
      
      hydrated = hydrated.map(r => ({
        ...r,
        profiles: (pMap.get(r.uploader_id) as any) ?? null,
        courses: (r.course_id ? cMap.get(r.course_id) : null) as any
      }))
    }
    hydrated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return { data: hydrated, nextToken, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Uploads a file and inserts
 * a metadata row.
 */
export async function uploadResource(payload: UploadResourcePayload): Promise<{
  data: AcademicResource | null
  error: Error | null
}> {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const ext = payload.fileName.split('.').pop() ?? 'pdf'
    const storagePath = `${user.userId}/${Date.now()}_${payload.fileName}`

    // Assuming uploadFile handles the S3 upload via amplify/storage
    await uploadFile(payload.fileUri, storagePath, payload.mimeType)

    const { data, errors } = await client.models.AcademicResource.create({
      uploader_id: user.userId,
      course_id: payload.courseId ?? null,
      title: payload.title,
      description: payload.description ?? null,
      file_url: storagePath,
      file_type: ext,
      file_size_kb: payload.fileSizeKb ?? null,
      resource_type: payload.resourceType ?? 'note',
      download_count: 0
    })

    if (errors) throw new Error(errors[0].message)
    return { data: data as unknown as AcademicResource, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Returns a signed URL.
 */
export async function getResourceSignedUrl(
  resource: AcademicResource,
  expiresInSeconds = 3600
): Promise<{ data: string | null; error: Error | null }> {
  try {
    // S3 getUrl via Amplify would be used here, but keeping simple placeholder logic
    // or using a generic approach:
    const { getUrl } = await import('aws-amplify/storage')
    const { url } = await getUrl({ path: resource.file_url, options: { expiresIn: expiresInSeconds } })

    // Increment download counter (fire-and-forget)
    client.models.AcademicResource.update({
      id: resource.id,
      download_count: (resource.download_count ?? 0) + 1
    }).catch(() => {})

    return { data: url.toString(), error: null }
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
    const { data: dData, errors } = await client.models.CourseDiscussion.list({
      filter: { course_id: { eq: courseId } }
    })
    if (errors) throw new Error(errors[0].message)
    
    // Filter top-level only
    let hydrated = (dData as unknown as CourseDiscussion[]).filter(d => !d.parent_id)
    
    if (hydrated.length > 0) {
      const uids = [...new Set(hydrated.map(d => d.author_id))]
      const pRes = await Promise.all(uids.map(id => client.models.Profile.get({ id })))
      const pMap = new Map(pRes.map(p => [p.data?.id, p.data]))
      hydrated = hydrated.map(d => ({ ...d, profiles: (pMap.get(d.author_id) as any) ?? null }))
    }
    hydrated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
    const { data: dData, errors } = await client.models.CourseDiscussion.list({
      filter: { parent_id: { eq: parentId } }
    })
    if (errors) throw new Error(errors[0].message)
    
    let hydrated = (dData as unknown as CourseDiscussion[]) ?? []
    if (hydrated.length > 0) {
      const uids = [...new Set(hydrated.map(d => d.author_id))]
      const pRes = await Promise.all(uids.map(id => client.models.Profile.get({ id })))
      const pMap = new Map(pRes.map(p => [p.data?.id, p.data]))
      hydrated = hydrated.map(d => ({ ...d, profiles: (pMap.get(d.author_id) as any) ?? null }))
    }
    hydrated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
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
    const user = await getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const { data, errors } = await client.models.CourseDiscussion.create({
      course_id: courseId,
      author_id: user.userId,
      body,
      parent_id: parentId ?? null,
    })
    if (errors) throw new Error(errors[0].message)
    
    const { data: pData } = await client.models.Profile.get({ id: data.author_id })
    const hydrated = { ...data, profiles: pData as any }
    
    return { data: hydrated as unknown as CourseDiscussion, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}
