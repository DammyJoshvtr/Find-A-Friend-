import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Profile: a.model({
    id: a.id(),
    email: a.string(),
    full_name: a.string(),
    bio: a.string(),
    department: a.string(),
    level: a.string(),
    interests: a.string().array(),
    avatar_url: a.string(),
    push_token: a.string(),
    role: a.string(), // 'student' | 'admin' | 'vendor'
    follower_count: a.integer(),
    following_count: a.integer(),
    is_online: a.boolean(),
    is_verified: a.boolean(),
    cover_url: a.string(),
    badge_type: a.string(),
    badge_color: a.string(),
    current_streak: a.integer(),
    longest_streak: a.integer(),
    last_active_date: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  profiles: a.model({
    id: a.id(),
    email: a.string(),
    full_name: a.string(),
    bio: a.string(),
    department: a.string(),
    level: a.string(),
    interests: a.string().array(),
    avatar_url: a.string(),
    push_token: a.string(),
    role: a.string(),
    follower_count: a.integer(),
    following_count: a.integer(),
    is_online: a.boolean(),
    is_verified: a.boolean(),
    cover_url: a.string(),
    badge_type: a.string(),
    badge_color: a.string(),
    current_streak: a.integer(),
    longest_streak: a.integer(),
    last_active_date: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),
  
  Post: a.model({
    id: a.id(),
    author_id: a.string().required(),
    body: a.string().required(),
    tags: a.string().array(),
    image_url: a.string(),
    is_anonymous: a.boolean(),
    likes_count: a.integer(),
    comments_count: a.integer(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  posts: a.model({
    id: a.id(),
    author_id: a.string().required(),
    body: a.string().required(),
    tags: a.string().array(),
    image_url: a.string(),
    is_anonymous: a.boolean(),
    likes_count: a.integer(),
    comments_count: a.integer(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  Club: a.model({
    id: a.id(),
    name: a.string().required(),
    description: a.string(),
    color: a.string(),
    logo_url: a.string(),
    settings_send_messages: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  clubs: a.model({
    id: a.id(),
    name: a.string().required(),
    description: a.string(),
    color: a.string(),
    logo_url: a.string(),
    settings_send_messages: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  ClubMember: a.model({
    id: a.id(),
    club_id: a.string().required(),
    user_id: a.string().required(),
    role: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  messages: a.model({
    id: a.id(),
    conversation_id: a.string(),
    sender_id: a.string(),
    body: a.string(),
    is_read: a.boolean(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  Conversation: a.model({
    id: a.id(),
    name: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  club_messages: a.model({
    id: a.id(),
    club_id: a.string(),
    sender_id: a.string(),
    body: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  study_group_messages: a.model({
    id: a.id(),
    group_id: a.string(),
    sender_id: a.string(),
    body: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  feedbacks: a.model({
    id: a.id(),
    author_id: a.string(),
    body: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  feedback_comments: a.model({
    id: a.id(),
    feedback_id: a.string(),
    author_id: a.string(),
    body: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  feedback_comment_likes: a.model({
    id: a.id(),
    comment_id: a.string(),
    user_id: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  post_comments: a.model({
    id: a.id(),
    post_id: a.string(),
    author_id: a.string(),
    body: a.string(),
    is_anonymous: a.boolean(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  hashtags: a.model({
    id: a.id(),
    name: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  follows: a.model({
    id: a.id(),
    follower_id: a.string(),
    following_id: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  Follow: a.model({
    id: a.id(),
    follower_id: a.string(),
    following_id: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  stories: a.model({
    id: a.id(),
    author_id: a.string(),
    image_url: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  story_views: a.model({
    id: a.id(),
    story_id: a.string(),
    viewer_id: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  DiscoverLikes: a.model({
    id: a.id(),
    liker_id: a.string(),
    liked_id: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  Notification: a.model({
    id: a.id(),
    user_id: a.string(),
    type: a.string(),
    body: a.string(),
    is_read: a.boolean(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  LiveGameSession: a.model({
    id: a.id(),
    host_id: a.string(),
    guest_id: a.string(),
    game_type: a.string(),
    status: a.string(),
    winner_id: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  Vendor: a.model({
    id: a.id(),
    name: a.string(),
    category: a.string(),
    rating: a.float(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  Event: a.model({
    id: a.id(),
    title: a.string(),
    description: a.string(),
    date: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  Connection: a.model({
    id: a.id(),
    requester_id: a.string(),
    receiver_id: a.string(),
    status: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  Course: a.model({
    id: a.id(),
    code: a.string(),
    name: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  CourseEnrollment: a.model({
    id: a.id(),
    course_id: a.string(),
    user_id: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  StudyGroup: a.model({
    id: a.id(),
    name: a.string(),
    course_id: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  StudyGroupMember: a.model({
    id: a.id(),
    group_id: a.string(),
    user_id: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  AcademicResource: a.model({
    id: a.id(),
    title: a.string(),
    url: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  CourseDiscussion: a.model({
    id: a.id(),
    course_id: a.string(),
    author_id: a.string(),
    body: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  AnonymousPostAudit: a.model({
    id: a.id(),
    post_id: a.string(),
    author_id: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  ClubAnnouncement: a.model({
    id: a.id(),
    club_id: a.string(),
    author_id: a.string(),
    body: a.string(),
  }).authorization(allow => [allow.publicApiKey(), allow.authenticated()]),

  // ==========================================
  // REAL-TIME BROADCAST ENGINE
  // ==========================================
  
  RealtimeEvent: a.customType({
    channelId: a.string().required(),
    event: a.string().required(),
    payload: a.string().required(),
  }),

  publishRealtimeEvent: a.mutation()
    .arguments({
      channelId: a.string().required(),
      event: a.string().required(),
      payload: a.string().required(),
    })
    .returns(a.ref('RealtimeEvent'))
    .authorization(allow => [allow.publicApiKey(), allow.authenticated()])
    .handler(a.handler.custom({
      entry: './publishRealtimeEvent.js',
    })),

  onRealtimeEvent: a.subscription()
    .for(a.ref('publishRealtimeEvent'))
    .arguments({ channelId: a.string() })
    .authorization(allow => [allow.publicApiKey(), allow.authenticated()])
    .handler(a.handler.custom({
      entry: './onRealtimeEvent.js',
    })),

});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
