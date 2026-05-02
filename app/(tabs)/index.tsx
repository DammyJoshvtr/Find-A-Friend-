import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { sendConnectionRequest } from '../../lib/connections'
import { calculateMatchScore, getInitials, getTimeAgo } from '../../lib/matching'
import { createPost, getFeedPosts } from '../../lib/posts'
import { getAllProfiles, getCurrentProfile } from '../../lib/profiles'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'react-native'
import { supabase } from '../../lib/supabase'

export default function HomeScreen() {
  const [posts, setPosts] = useState<any[]>([])
  const [people, setPeople] = useState<any[]>([])
  const [myProfile, setMyProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showNewPost, setShowNewPost] = useState(false)
  const [newPostBody, setNewPostBody] = useState('')
  const [newPostTags, setNewPostTags] = useState('')
  const [posting, setPosting] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)

  const loadData = useCallback(async () => {
    try {
      const [feedPosts, profiles, profile] = await Promise.all([
        getFeedPosts(),
        getAllProfiles(),
        getCurrentProfile(),
      ])
      setPosts(feedPosts)
      setMyProfile(profile)
      const withScores = profiles.map((p: any) => ({
        ...p,
        matchScore: calculateMatchScore(
          profile?.interests ?? [],
          p.interests ?? []
        ),
      })).sort((a: any, b: any) => b.matchScore - a.matchScore)
      setPeople(withScores)
    } catch (error) {
      console.log('Load error:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

  const submitPost = async () => {
    if (!newPostBody.trim()) return
    setPosting(true)
    let imageUrl = null
    if (selectedImage) {
      imageUrl = await uploadImage(selectedImage)
    }
    const tags = newPostTags.split(',').map(t => t.trim()).filter(Boolean)
    await createPost(newPostBody.trim(), tags, imageUrl)
    setNewPostBody('')
    setNewPostTags('')
    setSelectedImage(null)
    setPosting(false)
    setShowNewPost(false)
    loadData()
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })
    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri)
    }
  }

  const uploadImage = async (uri) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const ext = uri.split('.').pop()
    const fileName = user.id + '_' + Date.now() + '.' + ext
    const response = await fetch(uri)
    const blob = await response.blob()
    const { data, error } = await supabase.storage
      .from('posts-media')
      .upload(fileName, blob, { contentType: 'image/' + ext })
    if (error) { console.log('Upload error:', error); return null }
    const { data: urlData } = supabase.storage.from('posts-media').getPublicUrl(fileName)
    return urlData.publicUrl
  }

  const handleShare = (post: any) => {
    Alert.alert('Share', post.body.substring(0, 60) + '... shared from FAF')
  }

  const handleConnect = async (userId: string, name: string) => {
  const { error } = await sendConnectionRequest(userId)
  if (error) {
    Alert.alert('Already sent?', 'Request already sent or could not connect')
  } else {
    Alert.alert('Request sent!', `You sent a connection request to ${name}`)
  }
}


  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={styles.loadingText}>Loading FAF...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#a78bfa"
          />
        }>

        <View style={styles.header}>
          <Text style={styles.logo}>FAF</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setShowNewPost(true)}>
              <Ionicons name="create-outline" size={20} color="#f0f0ff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="notifications-outline" size={20} color="#f0f0ff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.greeting}>
          <Text style={styles.greetSub}>{greeting()},</Text>
          <Text style={styles.greetMain}>
            {myProfile?.full_name
              ? myProfile.full_name.split(' ')[0] + ' 👋'
              : 'Welcome to FAF 👋'}
          </Text>
        </View>

        {people.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>People you may know</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.peopleScroll}
              contentContainerStyle={{ paddingHorizontal: 16 }}>
              {people.slice(0, 8).map((person: any, i: number) => (
                <TouchableOpacity key={person.id ?? i} style={styles.personCard}>
                  <View style={styles.personAvatar}>
                    <Text style={styles.personInitials}>
                      {getInitials(person.full_name ?? person.email)}
                    </Text>
                  </View>
                  <Text style={styles.personName} numberOfLines={1}>
                    {person.full_name
                      ? person.full_name.split(' ')[0]
                      : person.email?.split('@')[0]}
                  </Text>
                  <Text style={styles.personMatch}>
                    {person.matchScore}% match
                  </Text>
                  <TouchableOpacity
                    style={styles.connectBtn}
                    onPress={() => handleConnect(person.id, person.full_name ?? 'this person')}>
                    <Text style={styles.connectText}>+ Add</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Campus feed</Text>
          <TouchableOpacity onPress={() => setShowNewPost(true)}>
            <Text style={styles.seeAll}>+ Post</Text>
          </TouchableOpacity>
        </View>

        {posts.length === 0 ? (
          <View style={styles.emptyFeed}>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyText}>
              Be the first to post on campus!
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setShowNewPost(true)}>
              <Text style={styles.emptyBtnText}>Create first post</Text>
            </TouchableOpacity>
          </View>
        ) : (
          posts.map((post: any, i: number) => (
            <View key={post.id ?? i} style={styles.feedCard}>
              <View style={styles.feedHeader}>
                <View style={styles.feedAvatar}>
                  <Text style={styles.feedAvatarText}>
                    {getInitials(post.profiles?.full_name ?? 'AN')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feedName}>
                    {post.profiles?.full_name ?? 'Anonymous'}
                  </Text>
                  <Text style={styles.feedTime}>
                    {getTimeAgo(post.created_at)}
                    {post.profiles?.department
                      ? ' · ' + post.profiles.department
                      : ''}
                  </Text>
                </View>
              </View>
              <Text style={styles.feedBody}>{post.body}</Text>
              {post.tags?.length > 0 && (
                <View style={styles.feedTags}>
                  {post.tags.map((tag: string, j: number) => (
                    <View key={j} style={styles.tag}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.feedActions}>
                <TouchableOpacity style={styles.actionBtn}>
                  <Ionicons name="heart-outline" size={14} color="rgba(240,240,255,0.5)" />
                  <Text style={styles.feedAction}>{post.likes_count ?? 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                  <Ionicons name="chatbubble-outline" size={14} color="rgba(240,240,255,0.5)" />
                  <Text style={styles.feedAction}>{post.comments_count ?? 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleShare(post)}>
                  <Ionicons name="share-outline" size={14} color="rgba(240,240,255,0.5)" />
                  <Text style={styles.feedAction}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal visible={showNewPost} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New post</Text>
              <TouchableOpacity onPress={() => setShowNewPost(false)}>
                <Ionicons name="close" size={22} color="rgba(240,240,255,0.4)" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.postInput}
              placeholder="What is on your mind? Share with campus..."
              placeholderTextColor="rgba(240,240,255,0.3)"
              value={newPostBody}
              onChangeText={setNewPostBody}
              multiline
              maxLength={500}
              autoFocus
            />
            <TextInput
              style={styles.tagInput}
              placeholder="Tags — separate with commas"
              placeholderTextColor="rgba(240,240,255,0.3)"
              value={newPostTags}
              onChangeText={setNewPostTags}
            />
            {selectedImage && (
              <View style={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden' }}>
                <Image source={{ uri: selectedImage }} style={{ width: '100%', height: 200, borderRadius: 12 }} />
                <TouchableOpacity
                  onPress={() => setSelectedImage(null)}
                  style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 12 }}>✕ Remove</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' }}
              onPress={pickImage}>
              <Text style={{ fontSize: 20 }}>📷</Text>
              <Text style={{ color: 'rgba(240,240,255,0.6)', fontSize: 13 }}>{selectedImage ? 'Change photo' : 'Add a photo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.postBtn, posting && { opacity: 0.6 }]}
              onPress={submitPost}
              disabled={posting}>
              {posting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.postBtnText}>Post to campus feed</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d14' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: 'rgba(240,240,255,0.4)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  logo: { fontSize: 24, fontWeight: '800', color: '#a78bfa' },
  headerIcons: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1c1c2e', alignItems: 'center', justifyContent: 'center' },
  greeting: { paddingHorizontal: 16, paddingBottom: 16 },
  greetSub: { fontSize: 12, color: 'rgba(240,240,255,0.4)' },
  greetMain: { fontSize: 18, fontWeight: '600', color: '#f0f0ff' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '500', color: 'rgba(240,240,255,0.6)' },
  seeAll: { fontSize: 12, color: '#a78bfa' },
  peopleScroll: { marginBottom: 20 },
  personCard: { width: 90, backgroundColor: '#1c1c2e', borderRadius: 14, padding: 10, alignItems: 'center', marginRight: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  personAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2a1e40', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  personInitials: { fontSize: 14, fontWeight: '600', color: '#c4b5fd' },
  personName: { fontSize: 10, fontWeight: '500', color: '#f0f0ff', marginBottom: 2, width: '100%', textAlign: 'center' },
  personMatch: { fontSize: 9, fontWeight: '600', color: '#a78bfa', marginBottom: 6 },
  connectBtn: { width: '100%', backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 20, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)', alignItems: 'center' },
  connectText: { fontSize: 9, color: '#a78bfa', fontWeight: '500' },
  feedCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1c1c2e', borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  feedAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2a1e40', alignItems: 'center', justifyContent: 'center' },
  feedAvatarText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  feedName: { fontSize: 12, fontWeight: '500', color: '#f0f0ff' },
  feedTime: { fontSize: 10, color: 'rgba(240,240,255,0.35)' },
  feedBody: { fontSize: 13, color: 'rgba(240,240,255,0.7)', lineHeight: 20, marginBottom: 10 },
  feedTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  tag: { backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 10, color: '#a78bfa', fontWeight: '500' },
  feedActions: { flexDirection: 'row', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feedAction: { fontSize: 11, color: 'rgba(240,240,255,0.35)' },
  emptyFeed: { margin: 16, backgroundColor: '#1c1c2e', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#f0f0ff', marginBottom: 6 },
  emptyText: { fontSize: 13, color: 'rgba(240,240,255,0.4)', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyBtn: { backgroundColor: '#a78bfa', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1c1c2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#f0f0ff' },
  postInput: { backgroundColor: '#0d0d14', borderRadius: 12, padding: 14, fontSize: 14, color: '#f0f0ff', minHeight: 120, textAlignVertical: 'top', marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  tagInput: { backgroundColor: '#0d0d14', borderRadius: 12, padding: 14, fontSize: 13, color: '#f0f0ff', marginBottom: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  postBtn: { backgroundColor: '#a78bfa', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  postBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})