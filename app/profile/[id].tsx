/**
 * app/profile/[id].tsx
 * Public user profile — avatar, bio, follower counts, Follow/Unfollow, Posts | Liked tabs.
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getProfileById, getUserPosts } from '../../lib/profiles'
import { followUser, unfollowUser, getFollowStatus } from '../../lib/follows'
import { likePost } from '../../lib/feed'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/profiles'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'

type Tab = 'posts' | 'liked'

interface MiniPost {
  id: string
  body: string
  tags: string[] | null
  image_url: string | null
  is_anonymous: boolean
  likes_count: number
  comments_count: number
  created_at: string
}

// ---------------------------------------------------------------------------
// Mini post card (grid + list modes are both handled here)
// ---------------------------------------------------------------------------

function MiniPostCard({ post, onPress }: { post: MiniPost; onPress: () => void }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes_count)

  const handleLike = async () => {
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikeCount(c => wasLiked ? Math.max(0, c - 1) : c + 1)
    const { error } = await likePost(post.id)
    if (error) {
      setLiked(wasLiked)
      setLikeCount(c => wasLiked ? c + 1 : Math.max(0, c - 1))
    }
  }

  return (
    <TouchableOpacity style={s.miniCard} onPress={onPress} activeOpacity={0.85}>
      {post.image_url && (
        <Image source={{ uri: post.image_url }} style={s.miniImage} resizeMode="cover" />
      )}
      <Text style={s.miniBody} numberOfLines={post.image_url ? 2 : 4}>{post.body}</Text>
      <View style={s.miniFooter}>
        <TouchableOpacity style={s.miniAction} onPress={handleLike} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={13} color={liked ? '#ef4444' : 'rgba(240,240,255,0.35)'} />
          <Text style={s.miniActionText}>{likeCount}</Text>
        </TouchableOpacity>
        <View style={s.miniAction}>
          <Ionicons name="chatbubble-outline" size={12} color="rgba(240,240,255,0.35)" />
          <Text style={s.miniActionText}>{post.comments_count}</Text>
        </View>
        <Text style={s.miniTime}>{getTimeAgo(post.created_at)}</Text>
      </View>
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProfileScreen() {
  const theme = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOwnProfile, setIsOwnProfile] = useState(false)

  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [followLoading, setFollowLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>('posts')
  const [posts, setPosts] = useState<MiniPost[]>([])
  const [likedPosts, setLikedPosts] = useState<MiniPost[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  useEffect(() => {
    if (id) loadProfile()
  }, [id])

  useEffect(() => {
    if (id && profile) loadTabData(activeTab)
  }, [activeTab, profile])

  const refreshCounts = useCallback(async () => {
    const [followerRes, followingRes] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
    ])
    if (followerRes.count !== null) setFollowerCount(followerRes.count)
    if (followingRes.count !== null) setFollowingCount(followingRes.count)
  }, [id])

  // Real-time: follower/following counts + new posts
  useEffect(() => {
    if (!id) return
    const channelName = `profile-rt:${id}`

    // Remove any stale channel with this name (e.g. after React Navigation reconnect)
    const stale = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`)
    if (stale) supabase.removeChannel(stale)

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'follows',
        filter: `following_id=eq.${id}`,
      }, () => { refreshCounts() })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'follows',
        filter: `following_id=eq.${id}`,
      }, () => { refreshCounts() })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'posts',
        filter: `author_id=eq.${id}`,
      }, (payload: any) => {
        if (!payload.new.is_anonymous) {
          setPosts(prev => [payload.new as MiniPost, ...prev])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // refreshCounts is stable while id is unchanged; omit to prevent double-subscribe on reconnect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const [profileRes, statusRes, followerRes, followingRes] = await Promise.all([
        getProfileById(id),
        getFollowStatus(id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
      ])

      const p = profileRes
      setProfile(p)
      setFollowerCount(followerRes.count ?? p?.follower_count ?? 0)
      setFollowingCount(followingRes.count ?? p?.following_count ?? 0)
      setFollowing(statusRes.data === 'following')
      const own = user?.id === id
      setIsOwnProfile(own)
      if (own) {
        router.replace('/profile' as any)
        return
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }

  const loadTabData = async (tab: Tab) => {
    setTabLoading(true)
    if (tab === 'posts') {
      const data = await getUserPosts(id)
      setPosts(data as MiniPost[])
    } else {
      // Liked posts — fetch from liked_posts view or posts joined with likes
      const { data: { user } } = await supabase.auth.getUser()
      const targetId = user?.id === id ? user.id : id
      const { data } = await supabase
        .from('post_likes')
        .select('post_id, posts(id, body, tags, image_url, is_anonymous, likes_count, comments_count, created_at)')
        .eq('user_id', targetId)
        .order('created_at', { ascending: false })
        .limit(30)
      const likedData = (data ?? [])
        .map((r: any) => r.posts)
        .filter(Boolean) as MiniPost[]
      setLikedPosts(likedData)
    }
    setTabLoading(false)
  }

  const handleFollowToggle = async () => {
    if (isOwnProfile) {
      router.push('/edit-profile' as any)
      return
    }
    setFollowLoading(true)
    if (following) {
      setFollowing(false)
      setFollowerCount(c => Math.max(0, c - 1))
      const { error } = await unfollowUser(id)
      if (error) {
        setFollowing(true)
        setFollowerCount(c => c + 1)
      }
    } else {
      setFollowing(true)
      setFollowerCount(c => c + 1)
      const { error } = await followUser(id)
      if (error) {
        setFollowing(false)
        setFollowerCount(c => Math.max(0, c - 1))
      }
    }
    setFollowLoading(false)
  }

  const onRefresh = useCallback(() => {
    loadTabData(activeTab)
  }, [activeTab])

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <Text style={s.errorText}>Profile not found</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => router.back()}>
            <Text style={s.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const displayPosts = activeTab === 'posts' ? posts : likedPosts

  const renderHeader = () => (
    <>
      {/* Back button */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#f0f0ff" />
        </TouchableOpacity>
        {isOwnProfile && (
          <TouchableOpacity style={s.editBtn} onPress={() => router.push('/edit-profile' as any)}>
            <Ionicons name="create-outline" size={18} color="#a78bfa" />
          </TouchableOpacity>
        )}
      </View>

      {/* Avatar */}
      <View style={s.avatarSection}>
        <View style={s.avatarRing}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Text style={s.avatarInitials}>{getInitials(profile.full_name ?? '??')}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Name + bio */}
      <View style={s.nameSection}>
        <Text style={s.name}>{profile.full_name ?? 'Student'}</Text>
        {(profile.department || profile.level) && (
          <Text style={s.dept}>
            {[profile.department, profile.level].filter(Boolean).join(' · ')}
          </Text>
        )}
        {profile.bio && <Text style={s.bio}>{profile.bio}</Text>}
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statValue}>{posts.length}</Text>
          <Text style={s.statLabel}>Posts</Text>
        </View>
        <TouchableOpacity
          style={s.statItem}
          onPress={() => router.push(`/followers/${id}` as any)}>
          <Text style={s.statValue}>{followerCount}</Text>
          <Text style={s.statLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.statItem}
          onPress={() => router.push(`/following/${id}` as any)}>
          <Text style={s.statValue}>{followingCount}</Text>
          <Text style={s.statLabel}>Following</Text>
        </TouchableOpacity>
      </View>

      {/* Interests */}
      {profile.interests && profile.interests.length > 0 && (
        <View style={s.interestsRow}>
          {profile.interests.slice(0, 6).map((interest, i) => (
            <View key={i} style={s.interestChip}>
              <Text style={s.interestText}>{interest}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Follow / Edit button */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={[
            s.followBtn,
            following && s.followingBtn,
            isOwnProfile && s.editProfileBtn,
          ]}
          onPress={handleFollowToggle}
          disabled={followLoading}>
          {followLoading
            ? <ActivityIndicator size="small" color={following ? '#a78bfa' : '#fff'} />
            : <Text style={[s.followText, following && s.followingText, isOwnProfile && s.editProfileText]}>
                {isOwnProfile ? 'Edit Profile' : following ? 'Following' : 'Follow'}
              </Text>}
        </TouchableOpacity>
        {!isOwnProfile && (
          <TouchableOpacity
            style={s.messageBtn}
            onPress={() => router.push(`/chat/${id}` as any)}>
            <Ionicons name="chatbubble-outline" size={16} color="#a78bfa" />
            <Text style={s.messageBtnText}>Message</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'posts' && s.tabActive]}
          onPress={() => setActiveTab('posts')}>
          <Ionicons
            name="grid-outline"
            size={16}
            color={activeTab === 'posts' ? '#a78bfa' : 'rgba(240,240,255,0.4)'}
          />
          <Text style={[s.tabText, activeTab === 'posts' && s.tabTextActive]}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'liked' && s.tabActive]}
          onPress={() => setActiveTab('liked')}>
          <Ionicons
            name="heart-outline"
            size={16}
            color={activeTab === 'liked' ? '#a78bfa' : 'rgba(240,240,255,0.4)'}
          />
          <Text style={[s.tabText, activeTab === 'liked' && s.tabTextActive]}>Liked</Text>
        </TouchableOpacity>
      </View>

      {tabLoading && (
        <ActivityIndicator color="#a78bfa" style={{ marginTop: 20 }} />
      )}
    </>
  )

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <FlatList
        data={tabLoading ? [] : displayPosts}
        keyExtractor={item => item.id}
        numColumns={1}
        renderItem={({ item }) => (
          <MiniPostCard
            post={item}
            onPress={() => router.push(`/post/${item.id}` as any)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !tabLoading ? (
            <View style={s.empty}>
              <Ionicons
                name={activeTab === 'posts' ? 'document-outline' : 'heart-outline'}
                size={36}
                color="rgba(240,240,255,0.1)"
              />
              <Text style={s.emptyText}>
                {activeTab === 'posts' ? 'No posts yet' : 'No liked posts'}
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#a78bfa" />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centeredWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  retryBtn: { backgroundColor: '#a78bfa', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  editBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center',
  },
  avatarSection: { alignItems: 'center', marginTop: 8, marginBottom: 14 },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: '#a78bfa',
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: '#2a1e40', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 28, fontFamily: typography.fontBold, color: '#c4b5fd' },
  nameSection: { alignItems: 'center', paddingHorizontal: 32, marginBottom: 16 },
  name: { fontSize: 22, fontFamily: typography.fontBold, color: '#f0f0ff', marginBottom: 4 },
  dept: { fontSize: 13, color: 'rgba(240,240,255,0.4)', marginBottom: 8, fontFamily: typography.fontRegular },
  bio: { fontSize: 13, color: 'rgba(240,240,255,0.6)', textAlign: 'center', lineHeight: 18, fontFamily: typography.fontRegular },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 16, marginBottom: 14,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontFamily: typography.fontBold, color: '#f0f0ff' },
  statLabel: { fontSize: 11, color: 'rgba(240,240,255,0.35)', fontFamily: typography.fontMedium },
  interestsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, marginBottom: 14, justifyContent: 'center',
  },
  interestChip: {
    backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  interestText: { fontSize: 11, color: '#c4b5fd', fontFamily: typography.fontMedium },
  actionRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16,
  },
  followBtn: {
    flex: 1, backgroundColor: '#a78bfa', borderRadius: 20,
    paddingVertical: 10, alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.4)',
  },
  editProfileBtn: {
    backgroundColor: '#1c1c2e',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  followText: { fontSize: 14, fontFamily: typography.fontSemiBold, color: '#fff' },
  followingText: { color: '#a78bfa' },
  editProfileText: { color: 'rgba(240,240,255,0.6)' },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1c1c2e', borderRadius: 20, paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  messageBtnText: { fontSize: 14, fontFamily: typography.fontMedium, color: '#a78bfa' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#a78bfa' },
  tabText: { fontSize: 12, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontMedium },
  tabTextActive: { color: '#a78bfa', fontFamily: typography.fontBold },
  // Mini post card
  miniCard: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#1c1c2e', borderRadius: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  miniImage: { width: '100%', height: 180 },
  miniBody: {
    fontSize: 13, color: 'rgba(240,240,255,0.7)', lineHeight: 18,
    padding: 12, paddingBottom: 8, fontFamily: typography.fontRegular,
  },
  miniFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingBottom: 10,
  },
  miniAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniActionText: { fontSize: 11, color: 'rgba(240,240,255,0.4)', fontFamily: typography.fontRegular },
  miniTime: { fontSize: 10, color: 'rgba(240,240,255,0.25)', marginLeft: 'auto', fontFamily: typography.fontRegular },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.3)', fontFamily: typography.fontRegular },
})
