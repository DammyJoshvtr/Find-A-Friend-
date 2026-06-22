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
import { likeUser, unlikeUser, getConnectionStatus } from '../../lib/discoverLikes'
import type { ConnectionStatus } from '../../lib/discoverLikes'
import { Alert } from 'react-native'
import { likePost } from '../../lib/feed'
import { getInitials, getTimeAgo } from '../../lib/matching'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/profiles'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import VerifiedBadge from '../../components/ui/VerifiedBadge'

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
  const theme = useTheme()
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
    <TouchableOpacity style={[s.miniCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={onPress} activeOpacity={0.85}>
      {post.image_url && (
        <Image source={{ uri: post.image_url }} style={s.miniImage} resizeMode="cover" />
      )}
      <Text style={[s.miniBody, { color: theme.text }]}>{post.body}</Text>
      <View style={s.miniFooter}>
        <TouchableOpacity style={s.miniAction} onPress={handleLike} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={13} color={liked ? '#ef4444' : theme.textFaint} />
          <Text style={[s.miniActionText, { color: theme.textMuted }]}>{likeCount}</Text>
        </TouchableOpacity>
        <View style={s.miniAction}>
          <Ionicons name="chatbubble-outline" size={12} color={theme.textFaint} />
          <Text style={[s.miniActionText, { color: theme.textMuted }]}>{post.comments_count}</Text>
        </View>
        <Text style={[s.miniTime, { color: theme.textFaint }]}>{getTimeAgo(post.created_at)}</Text>
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none')
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
    const { data } = await supabase
      .from('profiles')
      .select('follower_count, following_count')
      .eq('id', id)
      .single()
    if (data) {
      setFollowerCount(data.follower_count ?? 0)
      setFollowingCount(data.following_count ?? 0)
    }
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

      const [profileRes, connStatus] = await Promise.all([
        getProfileById(id),
        getConnectionStatus(id),
      ])

      const p = profileRes
      setProfile(p)
      setFollowerCount(p?.follower_count ?? 0)
      setFollowingCount(p?.following_count ?? 0)
      setConnectionStatus(connStatus)
      setFollowing(connStatus === 'connected' || connStatus === 'requested_sent')
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

    try {
      if (connectionStatus === 'connected') {
        // Disconnect confirmation
        Alert.alert(
          'Disconnect',
          `Are you sure you want to disconnect from ${profile?.full_name ?? 'this student'}?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setFollowLoading(false) },
            {
              text: 'Disconnect',
              style: 'destructive',
              onPress: async () => {
                setFollowLoading(true)
                try {
                  setConnectionStatus('none')
                  setFollowing(false)
                  setFollowerCount(c => Math.max(0, c - 1))
                  await unlikeUser(id)
                  const { error } = await unfollowUser(id)
                  if (error) {
                    setConnectionStatus('connected')
                    setFollowing(true)
                    setFollowerCount(c => c + 1)
                  }
                } catch (e) {
                  console.warn(e)
                  setConnectionStatus('connected')
                  setFollowing(true)
                  setFollowerCount(c => c + 1)
                } finally {
                  setFollowLoading(false)
                }
              }
            }
          ]
        )
        return
      } else if (connectionStatus === 'requested_sent') {
        // Cancel request
        setConnectionStatus('none')
        setFollowing(false)
        setFollowerCount(c => Math.max(0, c - 1))
        await unlikeUser(id)
        const { error } = await unfollowUser(id)
        if (error) {
          setConnectionStatus('requested_sent')
          setFollowing(true)
          setFollowerCount(c => c + 1)
        }
      } else if (connectionStatus === 'requested_received') {
        // Accept request
        setConnectionStatus('connected')
        setFollowing(true)
        setFollowerCount(c => c + 1)
        await likeUser(id)
        const { error } = await followUser(id)
        if (error) {
          setConnectionStatus('requested_received')
          setFollowing(false)
          setFollowerCount(c => Math.max(0, c - 1))
        }
      } else {
        // Send request (none)
        setConnectionStatus('requested_sent')
        setFollowing(true)
        setFollowerCount(c => c + 1)
        await likeUser(id)
        const { error } = await followUser(id)
        if (error) {
          setConnectionStatus('none')
          setFollowing(false)
          setFollowerCount(c => Math.max(0, c - 1))
        }
      }
    } catch (e) {
      console.warn('[Profile] follow toggle error:', e)
    } finally {
      setFollowLoading(false)
    }
  }

  const onRefresh = useCallback(() => {
    loadTabData(activeTab)
  }, [activeTab])

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.centeredWrap}>
          <Text style={[s.errorText, { color: theme.textMuted }]}>Profile not found</Text>
          <TouchableOpacity style={[s.retryBtn, { backgroundColor: theme.accent }]} onPress={() => router.back()}>
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
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 0.5 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        {isOwnProfile && (
          <TouchableOpacity style={[s.editBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 0.5 }]} onPress={() => router.push('/edit-profile' as any)}>
            <Ionicons name="create-outline" size={18} color={theme.accent} />
          </TouchableOpacity>
        )}
      </View>

      {/* Avatar */}
      <View style={s.avatarSection}>
        <View style={[s.avatarRing, { borderColor: theme.accent }]}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
          ) : (
            <View style={[s.avatarPlaceholder, { backgroundColor: theme.cardSolid }]}>
              <Text style={[s.avatarInitials, { color: theme.accent }]}>{getInitials(profile.full_name ?? '??')}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Name + bio */}
      <View style={s.nameSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Text style={[s.name, { color: theme.text }]}>{profile.full_name ?? 'Student'}</Text>
          <VerifiedBadge type={profile.badge_type} customColor={profile.badge_color} size={18} />
          {(!profile.badge_type || profile.badge_type === 'none') && profile.role === 'admin' && (
            <View style={{ backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.45)' }}>
              <Text style={{ fontSize: 10, color: theme.accent, fontWeight: '500' }}>👑 Admin</Text>
            </View>
          )}
        </View>
        {(profile.department || profile.level) && (
          <Text style={[s.dept, { color: theme.textMuted }]}>
            {[profile.department, profile.level].filter(Boolean).join(' · ')}
          </Text>
        )}
        {profile.bio && <Text style={[s.bio, { color: theme.textMuted }]}>{profile.bio}</Text>}
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: theme.text }]}>{posts.length}</Text>
          <Text style={[s.statLabel, { color: theme.textFaint }]}>Posts</Text>
        </View>
        <TouchableOpacity
          style={s.statItem}
          onPress={() => router.push(`/followers/${id}` as any)}>
          <Text style={[s.statValue, { color: theme.text }]}>{followerCount}</Text>
          <Text style={[s.statLabel, { color: theme.textFaint }]}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.statItem}
          onPress={() => router.push(`/following/${id}` as any)}>
          <Text style={[s.statValue, { color: theme.text }]}>{followingCount}</Text>
          <Text style={[s.statLabel, { color: theme.textFaint }]}>Following</Text>
        </TouchableOpacity>
      </View>

      {/* Interests */}
      {profile.interests && profile.interests.length > 0 && (
        <View style={s.interestsRow}>
          {profile.interests.slice(0, 6).map((interest, i) => (
            <View key={i} style={[s.interestChip, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}>
              <Text style={[s.interestText, { color: theme.accent }]}>{interest}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Follow / Edit button */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={[
            s.followBtn,
            { backgroundColor: theme.accent },
            (connectionStatus === 'connected' || connectionStatus === 'requested_sent') && { backgroundColor: theme.accentBg, borderWidth: 0.5, borderColor: theme.accentBorder },
            isOwnProfile && { backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border },
          ]}
          onPress={handleFollowToggle}
          disabled={followLoading}>
          {followLoading
            ? <ActivityIndicator size="small" color={(connectionStatus === 'connected' || connectionStatus === 'requested_sent') ? theme.accent : '#fff'} />
            : <Text style={[
                s.followText,
                (connectionStatus === 'connected' || connectionStatus === 'requested_sent') && { color: theme.accent },
                isOwnProfile && { color: theme.textMuted }
              ]}>
                {isOwnProfile 
                  ? 'Edit Profile' 
                  : connectionStatus === 'connected' 
                  ? 'Connected' 
                  : connectionStatus === 'requested_sent' 
                  ? 'Requested' 
                  : connectionStatus === 'requested_received' 
                  ? 'Accept Request' 
                  : 'Connect 👋'}
              </Text>}
        </TouchableOpacity>
        {!isOwnProfile && (
          <TouchableOpacity
            style={[s.messageBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push(`/chat/${id}` as any)}>
            <Ionicons name="chatbubble-outline" size={16} color={theme.accent} />
            <Text style={[s.messageBtnText, { color: theme.accent }]}>Message</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { borderTopColor: theme.border, borderBottomWidth: 0.5, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'posts' && { borderBottomColor: theme.accent }]}
          onPress={() => setActiveTab('posts')}>
          <Ionicons
            name="grid-outline"
            size={16}
            color={activeTab === 'posts' ? theme.accent : theme.textFaint}
          />
          <Text style={[s.tabText, { color: activeTab === 'posts' ? theme.accent : theme.textFaint }, activeTab === 'posts' && { fontFamily: typography.fontBold }]}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'liked' && { borderBottomColor: theme.accent }]}
          onPress={() => setActiveTab('liked')}>
          <Ionicons
            name="heart-outline"
            size={16}
            color={activeTab === 'liked' ? theme.accent : theme.textFaint}
          />
          <Text style={[s.tabText, { color: activeTab === 'liked' ? theme.accent : theme.textFaint }, activeTab === 'liked' && { fontFamily: typography.fontBold }]}>Liked</Text>
        </TouchableOpacity>
      </View>

      {tabLoading && (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 20 }} />
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
                color={theme.textFaint}
              />
              <Text style={[s.emptyText, { color: theme.textMuted }]}>
                {activeTab === 'posts' ? 'No posts yet' : 'No liked posts'}
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={theme.accent} />
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
