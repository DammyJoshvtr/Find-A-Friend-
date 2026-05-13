import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, Modal, Linking, Dimensions,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withSpring,
  Easing,
} from 'react-native-reanimated'
import Toast from 'react-native-toast-message'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '../../lib/supabase'
import { getInitials } from '../../lib/matching'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import {
  pickMedia, takePhoto, recordVideo,
  parseAttachment,
  type Attachment,
} from '../../lib/chatAttachments'
import { GAME_META, type GameType } from '../../lib/games'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseChallenge(body: string): { _type: 'game_challenge'; gameType: string; emoji: string; label: string } | null {
  try {
    const obj = JSON.parse(body)
    if (obj?._type === 'game_challenge') return obj
    return null
  } catch { return null }
}

/**
 * Format a message timestamp in WhatsApp style:
 *   - Today   → "14:32"
 *   - Yesterday → "Yesterday 14:32"
 *   - Older   → "12/05 14:32"
 */
function formatMsgTime(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now  = new Date()

  const pad  = (n: number) => String(n).padStart(2, '0')
  const hhmm = `${pad(date.getHours())}:${pad(date.getMinutes())}`

  const isToday = date.toDateString() === now.toDateString()
  if (isToday) return hhmm

  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  if (isYesterday) return `Yesterday ${hhmm}`

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${hhmm}`
}

/**
 * Return a day-separator label for a given ISO date string:
 *   "Today", "Yesterday", or "Mon, 12 May"
 */
function getDayLabel(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now  = new Date()

  const isToday = date.toDateString() === now.toDateString()
  if (isToday) return 'Today'

  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  if (isYesterday) return 'Yesterday'

  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function isSameDay(a: string, b: string): boolean {
  if (!a || !b) return false
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// ─── Challenge bubble ─────────────────────────────────────────────────────────

function ChallengeBubble({ challenge, mine, convId, myId }: {
  challenge: { gameType: string; emoji: string; label: string }
  mine: boolean
  convId: string
  myId: string
}) {
  const theme = useTheme()
  const meta  = GAME_META[challenge.gameType as GameType]

  const handleAccept = async () => {
    await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: myId,
      body: `✅ Challenge accepted! Let's play ${challenge.emoji} ${challenge.label}!`,
    })
    const gameType = challenge.gameType as GameType
    if (gameType === 'trivia') router.push('/play/trivia' as any)
    else if (gameType === 'wordle') router.push('/play/wordle' as any)
    else router.push('/play/pool' as any)
  }

  const handleDecline = async () => {
    await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: myId,
      body: `❌ Declined the ${challenge.emoji} ${challenge.label} challenge.`,
    })
  }

  return (
    <View style={[cb.card, {
      backgroundColor: meta?.bg ?? 'rgba(167,139,250,0.1)',
      borderColor: meta?.border ?? 'rgba(167,139,250,0.3)',
    }]}>
      <Text style={cb.emoji}>{challenge.emoji}</Text>
      <Text style={[cb.tag, { color: theme.textFaint }]}>GAME CHALLENGE</Text>
      <Text style={[cb.label, { color: meta?.color ?? theme.accent }]}>{challenge.label}</Text>
      {mine ? (
        <Text style={[cb.waiting, { color: theme.textFaint }]}>Waiting for response…</Text>
      ) : (
        <View style={cb.btns}>
          <TouchableOpacity style={cb.declineBtn} onPress={handleDecline}>
            <Text style={cb.declineText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cb.acceptBtn, { backgroundColor: meta?.color ?? theme.accent }]}
            onPress={handleAccept}>
            <Text style={cb.acceptText}>Accept ⚡</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const cb = StyleSheet.create({
  card: {
    borderRadius: 18, padding: 18, borderWidth: 1,
    alignItems: 'center', gap: 4, minWidth: 210,
  },
  emoji:   { fontSize: 44, marginBottom: 2 },
  tag:     { fontSize: 10, fontFamily: typography.fontMedium, letterSpacing: 1 },
  label:   { fontSize: 17, fontFamily: typography.fontBold, marginBottom: 2 },
  waiting: { fontSize: 12, fontFamily: typography.fontRegular, marginTop: 8 },
  btns:    { flexDirection: 'row', gap: 10, marginTop: 12 },
  declineBtn: {
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.5)',
  },
  declineText: { fontSize: 13, fontFamily: typography.fontSemiBold, color: '#f87171' },
  acceptBtn:   { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9 },
  acceptText:  { fontSize: 13, fontFamily: typography.fontSemiBold, color: '#fff' },
})

// ─── Message actions modal ────────────────────────────────────────────────────

const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

function MessageActionsModal({ msg, mine, onClose, onEdit, onDelete, onReact }: {
  msg: any; mine: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onReact: (emoji: string) => void
}) {
  const theme = useTheme()
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={ma.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[ma.sheet, { backgroundColor: theme.card2, borderColor: theme.accentBorder }]}>
        <View style={[ma.handle, { backgroundColor: theme.border2 }]} />

        {/* Emoji reactions row */}
        <View style={ma.reactRow}>
          {REACTIONS.map(emoji => (
            <TouchableOpacity
              key={emoji}
              style={[ma.reactBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => { onReact(emoji); onClose() }}>
              <Text style={ma.reactEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[ma.divider, { backgroundColor: theme.border }]} />

        {mine && (
          <TouchableOpacity style={ma.actionRow} onPress={() => { onEdit(); onClose() }}>
            <Ionicons name="pencil-outline" size={18} color={theme.accent} />
            <Text style={[ma.actionLabel, { color: theme.text }]}>Edit message</Text>
          </TouchableOpacity>
        )}
        {mine && (
          <TouchableOpacity style={ma.actionRow} onPress={() => { onDelete(); onClose() }}>
            <Ionicons name="trash-outline" size={18} color="#f87171" />
            <Text style={[ma.actionLabel, { color: '#f87171' }]}>Delete message</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={ma.cancelRow} onPress={onClose}>
          <Text style={[ma.cancelLabel, { color: theme.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const ma = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 34,
    borderWidth: 0.5, borderBottomWidth: 0,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  reactRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal: 4 },
  reactBtn: { padding: 8, borderRadius: 14, borderWidth: 0.5 },
  reactEmoji: { fontSize: 26 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4 },
  actionLabel: { fontSize: 15, fontFamily: typography.fontMedium },
  cancelRow: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  cancelLabel: { fontSize: 14, fontFamily: typography.fontMedium },
})

// ─── Attachment sheet ─────────────────────────────────────────────────────────

const SHEET_OPTIONS = [
  { icon: 'camera-outline',   label: 'Camera',  key: 'camera'  },
  { icon: 'images-outline',   label: 'Gallery', key: 'gallery' },
  { icon: 'videocam-outline', label: 'Video',   key: 'video'   },
] as const

function AttachmentSheet({ visible, uploading, onClose, onSelect }: {
  visible: boolean; uploading: boolean
  onClose: () => void
  onSelect: (key: typeof SHEET_OPTIONS[number]['key']) => void
}) {
  const theme = useTheme()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={att.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[att.sheet, { backgroundColor: theme.card2, borderColor: theme.accentBorder }]}>
        <View style={[att.handle, { backgroundColor: theme.border2 }]} />
        <Text style={[att.title, { color: theme.text }]}>Send attachment</Text>
        {uploading ? (
          <View style={att.uploadingRow}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[att.uploadingText, { color: theme.textMuted }]}>Uploading…</Text>
          </View>
        ) : (
          <View style={att.grid}>
            {SHEET_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[att.option, { backgroundColor: theme.card, borderColor: theme.accentBorder }]}
                onPress={() => onSelect(opt.key)}>
                <View style={[att.iconWrap, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}>
                  <Ionicons name={opt.icon as any} size={26} color={theme.accent} />
                </View>
                <Text style={[att.optionLabel, { color: theme.text }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity style={[att.cancelBtn, { borderColor: theme.border }]} onPress={onClose}>
          <Text style={[att.cancelText, { color: theme.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const att = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34,
    borderWidth: 0.5, borderBottomWidth: 0,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 16, fontFamily: typography.fontSemiBold, marginBottom: 18, textAlign: 'center' },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  option: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 0.5 },
  iconWrap: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  optionLabel: { fontSize: 11, fontFamily: typography.fontMedium },
  cancelBtn: { paddingVertical: 14, borderRadius: 14, borderWidth: 0.5, alignItems: 'center' },
  cancelText: { fontSize: 14, fontFamily: typography.fontMedium },
  uploadingRow: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  uploadingText: { fontSize: 13, fontFamily: typography.fontRegular },
})

// ─── Attachment bubble ────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width

function AttachmentBubble({ attachment }: { attachment: Attachment; mine: boolean }) {
  const handleOpen = () => Linking.openURL(attachment.url).catch(() => {})

  if (attachment._type === 'image') {
    const imgW = Math.min(SCREEN_W * 0.65, 260)
    const aspectH = attachment.width && attachment.height
      ? imgW * (attachment.height / attachment.width) : imgW
    return (
      <TouchableOpacity onPress={handleOpen} activeOpacity={0.85}>
        <Image
          source={{ uri: attachment.url }}
          style={{ width: imgW, height: Math.min(aspectH, 320), borderRadius: 12 }}
          resizeMode="cover"
        />
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      style={[ab.videoWrap, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
      onPress={handleOpen}
      activeOpacity={0.85}>
      <View style={ab.playBtn}>
        <Ionicons name="play" size={24} color="#fff" />
      </View>
      <View style={ab.videoInfo}>
        <Ionicons name="videocam" size={14} color="rgba(255,255,255,0.8)" />
        <Text style={ab.videoLabel}>{attachment.name ?? 'Video'}</Text>
      </View>
    </TouchableOpacity>
  )
}

const ab = StyleSheet.create({
  videoWrap: { width: 220, borderRadius: 14, padding: 12, gap: 10 },
  playBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  videoInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  videoLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: typography.fontRegular },
})

// ─── Animated online pulse dot (WhatsApp green) ───────────────────────────────

function PulseDot() {
  const scale   = useSharedValue(1)
  const opacity = useSharedValue(0.9)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,   { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ), -1, true
    )
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 800 }),
        withTiming(0.9, { duration: 800 }),
      ), -1, true
    )
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[
      {
        position: 'absolute', bottom: 0, right: 0,
        width: 11, height: 11, borderRadius: 6,
        // WhatsApp green is used exclusively for the online presence dot
        backgroundColor: '#25D366',
        borderWidth: 2, borderColor: 'transparent',
      },
      style,
    ]} />
  )
}

// ─── Purple scan-line glow (online presence indicator at header top) ──────────

function ScanLine({ isOnline }: { isOnline: boolean }) {
  const lineOpacity = useSharedValue(isOnline ? 0.7 : 0.15)
  const shadowOp    = useSharedValue(isOnline ? 0.6 : 0.05)

  useEffect(() => {
    if (isOnline) {
      lineOpacity.value = withRepeat(
        withSequence(
          withTiming(1,   { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ), -1, true
      )
      shadowOp.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.2, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ), -1, true
      )
    } else {
      lineOpacity.value = withTiming(0.15, { duration: 400 })
      shadowOp.value    = withTiming(0.05, { duration: 400 })
    }
  }, [isOnline])

  const animStyle = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
    shadowOpacity: shadowOp.value,
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          backgroundColor: '#a78bfa',
          shadowColor: '#a78bfa',
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 8,
          elevation: 0,
        },
        animStyle,
      ]}
    />
  )
}

// ─── Day separator ────────────────────────────────────────────────────────────

function DaySeparator({ label }: { label: string }) {
  const theme = useTheme()
  return (
    <View style={ds.wrap}>
      <View style={[ds.line, { backgroundColor: theme.border }]} />
      <View style={[ds.pill, { backgroundColor: theme.card2, borderColor: theme.border }]}>
        <Text style={[ds.label, { color: theme.textFaint }]}>{label}</Text>
      </View>
      <View style={[ds.line, { backgroundColor: theme.border }]} />
    </View>
  )
}

const ds = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 8 },
  line:  { flex: 1, height: StyleSheet.hairlineWidth },
  pill:  { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 0.5 },
  label: { fontSize: 11, fontFamily: typography.fontMedium },
})

// ─── Empty state with pulse ───────────────────────────────────────────────────

function EmptyState({ name }: { name: string }) {
  const theme = useTheme()
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ), -1, true
    )
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <View style={es.wrap}>
      <Animated.View style={animStyle}>
        <Text style={es.emoji}>👋</Text>
      </Animated.View>
      <Text style={[es.text, { color: theme.textMuted }]}>Say hello to {name}!</Text>
    </View>
  )
}

const es = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingTop: 80, gap: 10 },
  emoji: { fontSize: 52 },
  text:  { fontSize: 14, fontFamily: typography.fontRegular },
})

// ─── Chat background dot pattern ─────────────────────────────────────────────
// Renders a subtle repeating dot grid behind the message list, mimicking
// WhatsApp's textured chat background without any exotic packages.

function ChatBackground() {
  const { width, height } = Dimensions.get('window')
  const DOT_SPACING = 22
  const DOT_RADIUS  = 1.2
  const cols = Math.ceil(width  / DOT_SPACING) + 1
  const rows = Math.ceil(height / DOT_SPACING) + 1

  const dots: { key: string; x: number; y: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push({ key: `${r}-${c}`, x: c * DOT_SPACING, y: r * DOT_SPACING })
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map(d => (
        <View
          key={d.key}
          style={{
            position: 'absolute',
            left: d.x,
            top: d.y,
            width: DOT_RADIUS * 2,
            height: DOT_RADIUS * 2,
            borderRadius: DOT_RADIUS,
            backgroundColor: 'rgba(167,139,250,0.06)',
          }}
        />
      ))}
    </View>
  )
}

// ─── Tick status indicator (sent / delivered / read) ─────────────────────────
// Single tick  = optimistic (sending)
// Double tick  = delivered
// Blue ticks   = read (approximated as any non-optimistic sent message)

function TickStatus({ optimistic, color }: { optimistic: boolean; color: string }) {
  if (optimistic) {
    // Single tick — message is still sending
    return <Text style={{ fontSize: 9, color, lineHeight: 13 }}>✓</Text>
  }
  // Double tick — delivered / read
  return <Text style={{ fontSize: 9, color: '#60a5fa', lineHeight: 13 }}>✓✓</Text>
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DirectMessageScreen() {
  const { id: otherUserId } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [myId, setMyId]                   = useState('')
  const [convId, setConvId]               = useState<string | null>(null)
  const [otherProfile, setOtherProfile]   = useState<any>(null)
  const [messages, setMessages]           = useState<any[]>([])
  const [input, setInput]                 = useState('')
  const [loading, setLoading]             = useState(true)
  const [sending, setSending]             = useState(false)
  const [inputFocused, setInputFocused]   = useState(false)
  const [showAttachSheet, setShowAttachSheet] = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [selectedMsg, setSelectedMsg]     = useState<any>(null)
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [reactions, setReactions]         = useState<Record<string, string[]>>({})
  const scrollRef = useRef<ScrollView>(null)
  const theme = useTheme()

  // ── Init ────────────────────────────────────────────────────────────────────

  const initConversation = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !otherUserId) { setLoading(false); return }
      setMyId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('id, full_name, avatar_url, is_online')
        .eq('id', otherUserId).single()
      setOtherProfile(profile)

      const { data: cid, error: rpcError } = await supabase.rpc('get_or_create_conversation', {
        p_other_user_id: otherUserId,
      })
      if (rpcError || !cid) {
        Toast.show({ type: 'error', text1: 'Could not start chat', text2: rpcError?.message })
        setLoading(false); return
      }
      setConvId(cid)

      const { data: msgs } = await supabase
        .from('messages').select('*, profiles(id, full_name, avatar_url)')
        .eq('conversation_id', cid).order('created_at', { ascending: true })
      setMessages(msgs ?? [])
      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100)
    } catch (err) {
      console.error('Init error:', err); setLoading(false)
    }
  }, [otherUserId])

  useEffect(() => { initConversation() }, [initConversation])

  // ── Realtime subscriptions ──────────────────────────────────────────────────

  useEffect(() => {
    if (!convId) return
    const channelName = `dm-chat:${convId}`
    const stale = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`)
    if (stale) supabase.removeChannel(stale)

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + convId,
      }, async (payload: any) => {
        const { data: profile } = await supabase
          .from('profiles').select('id, full_name, avatar_url')
          .eq('id', payload.new.sender_id).single()
        setMessages(prev => {
          const idx = prev.findIndex(m =>
            m._optimistic && m.body === payload.new.body && m.sender_id === payload.new.sender_id
          )
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...payload.new, profiles: profile }
            return updated
          }
          return [...prev, { ...payload.new, profiles: profile }]
        })
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + convId,
      }, (payload: any) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + convId,
      }, (payload: any) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old?.id))
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
        filter: `id=eq.${otherUserId}`,
      }, (payload: any) => {
        if ('is_online' in payload.new)
          setOtherProfile((prev: any) => prev ? { ...prev, is_online: payload.new.is_online } : prev)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [convId])

  // ── Message actions ─────────────────────────────────────────────────────────

  const deleteMessage = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId))
    const { error } = await supabase
      .from('messages').delete().eq('id', msgId).eq('sender_id', myId)
    if (error) {
      Toast.show({ type: 'error', text1: 'Could not delete message' })
      const { data: msgs } = await supabase
        .from('messages').select('*, profiles(id, full_name, avatar_url)')
        .eq('conversation_id', convId).order('created_at', { ascending: true })
      setMessages(msgs ?? [])
    }
  }

  const startEdit  = (msg: any) => { setEditingId(msg.id); setInput(msg.body) }
  const cancelEdit = () => { setEditingId(null); setInput('') }

  const commitEdit = async () => {
    if (!editingId || !input.trim()) return
    const newBody = input.trim()
    setMessages(prev => prev.map(m => m.id === editingId ? { ...m, body: newBody, edited: true } : m))
    setEditingId(null); setInput('')
    const { error } = await supabase
      .from('messages').update({ body: newBody }).eq('id', editingId).eq('sender_id', myId)
    if (error) Toast.show({ type: 'error', text1: 'Could not edit message' })
  }

  const addReaction = (msgId: string, emoji: string) => {
    setReactions(prev => {
      const list = prev[msgId] ?? []
      if (list.includes(emoji)) return { ...prev, [msgId]: list.filter(e => e !== emoji) }
      return { ...prev, [msgId]: [...list, emoji] }
    })
  }

  const sendMessage = async () => {
    if (editingId) { commitEdit(); return }
    if (!input.trim() || !convId || sending) return
    const text = input.trim(); setInput('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const optimistic = {
      id: `opt_${Date.now()}`, _optimistic: true,
      conversation_id: convId, sender_id: myId,
      body: text, created_at: new Date().toISOString(), profiles: null,
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)

    setSending(true)
    const { error: sendError } = await supabase.from('messages').insert({
      conversation_id: convId, sender_id: myId, body: text,
    })
    setSending(false)
    if (sendError) {
      setMessages(prev => prev.filter(m => !(m._optimistic && m.body === text)))
      Toast.show({ type: 'error', text1: 'Message not sent', text2: sendError.message })
    }
  }

  const sendAttachment = async (key: typeof SHEET_OPTIONS[number]['key']) => {
    if (!convId) return
    setUploading(true)
    try {
      let attach: Attachment | null = null
      if (key === 'camera')  attach = await takePhoto(convId)
      if (key === 'gallery') attach = await pickMedia(convId)
      if (key === 'video')   attach = await recordVideo(convId)
      if (!attach) { setUploading(false); setShowAttachSheet(false); return }

      setShowAttachSheet(false)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const body = JSON.stringify(attach)
      const optimistic = {
        id: `opt_${Date.now()}`, _optimistic: true,
        conversation_id: convId, sender_id: myId,
        body, created_at: new Date().toISOString(), profiles: null,
      }
      setMessages(prev => [...prev, optimistic])
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
      await supabase.from('messages').insert({ conversation_id: convId, sender_id: myId, body })
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: err?.message ?? 'Please try again.' })
      setShowAttachSheet(false)
    } finally {
      setUploading(false)
    }
  }

  const otherName = otherProfile?.full_name ?? 'Chat'
  const isOnline  = otherProfile?.is_online ?? false
  const hasText   = input.trim().length > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <AttachmentSheet
        visible={showAttachSheet}
        uploading={uploading}
        onClose={() => setShowAttachSheet(false)}
        onSelect={sendAttachment}
      />
      {selectedMsg && (
        <MessageActionsModal
          msg={selectedMsg}
          mine={selectedMsg.sender_id === myId}
          onClose={() => setSelectedMsg(null)}
          onEdit={() => startEdit(selectedMsg)}
          onDelete={() => deleteMessage(selectedMsg.id)}
          onReact={emoji => addReaction(selectedMsg.id, emoji)}
        />
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>

        {/* ── WhatsApp-style header ───────────────────────────────────────── */}
        <View style={[
          s.header,
          {
            backgroundColor: theme.card2,
            borderBottomColor: 'rgba(167,139,250,0.15)',
            shadowColor: '#a78bfa',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 10,
          },
        ]}>
          {/* Purple scan-line glow — preserved as the app's online presence indicator */}
          <ScanLine isOnline={isOnline} />

          {/* Back arrow */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={theme.accent} />
          </TouchableOpacity>

          {/* Avatar (36px circle, WhatsApp spec) */}
          <View style={s.avatarWrap}>
            {otherProfile?.avatar_url ? (
              <Image
                source={{ uri: otherProfile.avatar_url }}
                style={[
                  s.avatar,
                  {
                    borderWidth: 2,
                    borderColor: isOnline ? '#25D366' : 'rgba(167,139,250,0.3)',
                  },
                ]}
              />
            ) : (
              <View style={[
                s.avatarFallback,
                {
                  backgroundColor: theme.accentBg,
                  borderWidth: 2,
                  borderColor: isOnline ? '#25D366' : 'rgba(167,139,250,0.3)',
                },
              ]}>
                <Text style={s.avatarInitials}>{getInitials(otherName)}</Text>
              </View>
            )}
            {/* WhatsApp green online dot */}
            {isOnline && <PulseDot />}
          </View>

          {/* Name + status text */}
          <View style={{ flex: 1 }}>
            <Text style={[s.headerName, { color: theme.text }]} numberOfLines={1}>
              {otherName}
            </Text>
            <Text style={[s.headerStatus, { color: isOnline ? '#25D366' : theme.textFaint }]}>
              {isOnline ? 'Online' : 'Last seen recently'}
            </Text>
          </View>

          {/* Right action icons: video call, voice call, three-dots menu */}
          <View style={s.headerActions}>
            <TouchableOpacity style={s.headerIconBtn} hitSlop={8}>
              <Ionicons name="videocam-outline" size={22} color={theme.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerIconBtn} hitSlop={8}>
              <Ionicons name="call-outline" size={20} color={theme.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerIconBtn} hitSlop={8}>
              <Ionicons name="ellipsis-vertical" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Message list with dot-pattern background ─────────────────────── */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Subtle dot-grid background — WhatsApp texture equivalent */}
            <ChatBackground />

            <ScrollView
              ref={scrollRef}
              style={s.messages}
              contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}>

              {messages.length === 0 && <EmptyState name={otherName} />}

              {messages.map((m, i) => {
                const mine      = m.sender_id === myId
                const parsed    = parseAttachment(m.body)
                const challenge = parseChallenge(m.body)

                // Day separator — inserted before a message if the day differs from the previous
                const prevMsg   = messages[i - 1]
                const showSep   = i === 0 || !isSameDay(prevMsg?.created_at, m.created_at)
                const dayLabel  = showSep ? getDayLabel(m.created_at) : ''

                // ── Challenge bubble ────────────────────────────────────────
                if (challenge) {
                  return (
                    <View key={m.id ?? i}>
                      {showSep && <DaySeparator label={dayLabel} />}
                      <View style={[s.msgRow, mine && s.msgRowMine]}>
                        <ChallengeBubble
                          challenge={challenge}
                          mine={mine}
                          convId={convId!}
                          myId={myId}
                        />
                      </View>
                    </View>
                  )
                }

                // ── Regular message ─────────────────────────────────────────
                const msgReactions = reactions[m.id] ?? []

                return (
                  <View key={m.id ?? i}>
                    {showSep && <DaySeparator label={dayLabel} />}
                    <View style={[s.msgRow, mine && s.msgRowMine]}>
                      {/*
                        Bubble wrapper View — intentionally has NO maxWidth.
                        maxWidth lives only on the bubble TouchableOpacity (s.bubble)
                        to avoid the RN double-constraint squeezing bug.
                      */}
                      <View>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onLongPress={() => {
                            if (!m._optimistic) {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                              setSelectedMsg(m)
                            }
                          }}
                          delayLongPress={200}
                          style={[
                            s.bubble,
                            mine
                              ? [
                                  s.bubbleMine,
                                  {
                                    // Sent: purple tint matching app theme
                                    backgroundColor: 'rgba(167,139,250,0.25)',
                                    shadowColor: '#a78bfa',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: m._optimistic ? 0.1 : 0.35,
                                    shadowRadius: 8,
                                    elevation: m._optimistic ? 1 : 4,
                                    ...(parsed ? { padding: 4 } : {}),
                                  },
                                ]
                              : [
                                  s.bubbleTheirs,
                                  {
                                    // Received: dark card background
                                    backgroundColor: 'rgba(255,255,255,0.07)',
                                    borderColor: 'rgba(167,139,250,0.12)',
                                  },
                                ],
                            m._optimistic && { opacity: 0.6 },
                            editingId === m.id && {
                              borderWidth: 1.5,
                              borderColor: theme.accent,
                            },
                          ]}>
                          {parsed ? (
                            <AttachmentBubble attachment={parsed} mine={mine} />
                          ) : (
                            <Text style={[s.bubbleText, { color: theme.text }]}>
                              {m.body}
                            </Text>
                          )}

                          {/* Timestamp row inside bubble — WhatsApp style */}
                          <View style={s.bubbleMeta}>
                            {m.edited && (
                              <Text style={[s.bubbleEdited, { color: theme.textFaint }]}>
                                edited ·{' '}
                              </Text>
                            )}
                            <Text style={[s.bubbleTime, { color: theme.textFaint }]}>
                              {formatMsgTime(m.created_at)}
                            </Text>
                            {/* Tick status — only for sent messages */}
                            {mine && (
                              <TickStatus
                                optimistic={!!m._optimistic}
                                color={m._optimistic ? 'rgba(255,255,255,0.35)' : '#60a5fa'}
                              />
                            )}
                          </View>
                        </TouchableOpacity>

                        {/* Reaction pills */}
                        {msgReactions.length > 0 && (
                          <View style={[s.reactionsRow, mine && { justifyContent: 'flex-end' }]}>
                            {msgReactions.map((emoji, ri) => (
                              <TouchableOpacity
                                key={ri}
                                style={[s.reactionPill, { backgroundColor: theme.card2, borderColor: theme.accentBorder }]}
                                onPress={() => addReaction(m.id, emoji)}>
                                <Text style={s.reactionEmoji}>{emoji}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )
              })}
            </ScrollView>
          </View>
        )}

        {/* ── WhatsApp-style input bar ────────────────────────────────────── */}
        <View style={[
          s.inputOuter,
          {
            backgroundColor: 'rgba(13,13,20,0.97)',
            borderTopColor: 'rgba(167,139,250,0.2)',
          },
        ]}>
          {/* Edit banner */}
          {editingId && (
            <View style={[s.editBanner, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}>
              <Ionicons name="pencil-outline" size={14} color={theme.accent} />
              <Text style={[s.editBannerText, { color: theme.accent }]}>Editing message</Text>
              <TouchableOpacity onPress={cancelEdit} style={{ marginLeft: 'auto' }}>
                <Ionicons name="close" size={16} color={theme.accent} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[s.inputRow, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
            {/* Attach icon — hidden while editing to match WhatsApp behavior */}
            {!editingId && (
              <TouchableOpacity
                style={s.attachIconBtn}
                onPress={() => setShowAttachSheet(true)}
                hitSlop={8}>
                {/* Paperclip / attach icon */}
                <Ionicons name="attach-outline" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            )}

            {/* Pill-shaped text input */}
            <TextInput
              style={[
                s.input,
                {
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderColor: inputFocused ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.15)',
                  color: theme.text,
                  shadowColor: inputFocused ? '#a78bfa' : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: inputFocused ? 0.3 : 0,
                  shadowRadius: 6,
                },
              ]}
              placeholder={editingId ? 'Edit message…' : 'Message'}
              placeholderTextColor={theme.textFaint}
              value={input}
              onChangeText={setInput}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
            />

            {/*
              Send / mic button:
              - When input is empty: mic icon (grey, un-filled) — WhatsApp style
              - When text exists or editing: purple filled circle with send/checkmark icon
            */}
            {hasText || editingId ? (
              <TouchableOpacity
                style={[
                  s.sendBtn,
                  {
                    backgroundColor: editingId ? '#34d399' : theme.accent,
                    shadowColor: editingId ? '#34d399' : theme.accent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 10,
                    elevation: 6,
                  },
                ]}
                onPress={sendMessage}
                disabled={sending || !convId}
                activeOpacity={0.8}>
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name={editingId ? 'checkmark' : 'send'}
                    size={18}
                    color="#fff"
                  />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.micBtn, { borderColor: 'rgba(167,139,250,0.2)' }]}
                activeOpacity={0.7}
                // Mic button is a placeholder — voice recording is not yet implemented
                onPress={() => {}}>
                <Ionicons name="mic-outline" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
    position: 'relative',
    overflow: 'hidden',
  },
  backBtn: {
    // No background circle — WhatsApp uses a bare back arrow
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    position: 'relative',
    width: 36,
    height: 36,
  },
  // 36px circle as per WhatsApp spec
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    color: '#c4b5fd',
  },
  headerName: {
    fontSize: 14,
    fontFamily: typography.fontBold,
    lineHeight: 18,
  },
  headerStatus: {
    fontSize: 11,
    fontFamily: typography.fontRegular,
    marginTop: 1,
    lineHeight: 14,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerIconBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Message list ─────────────────────────────────────────────────────────────
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messages: { flex: 1 },

  // ── Message rows ─────────────────────────────────────────────────────────────
  msgRow:     { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 3 },
  msgRowMine: { flexDirection: 'row-reverse' },

  // ── Bubbles — maxWidth ONLY on this element (never on outer wrapper) ──────────
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 2,
  },
  bubbleMine: {
    // WhatsApp: bottom-right corner is nearly flat
    borderBottomRightRadius: 2,
  },
  bubbleTheirs: {
    // WhatsApp: bottom-left corner is nearly flat
    borderBottomLeftRadius: 2,
    borderWidth: 0.5,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: typography.fontRegular,
  },
  // Timestamp + tick row sits inside the bubble, bottom-right aligned
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 4,
  },
  bubbleEdited: {
    fontSize: 9,
    fontFamily: typography.fontRegular,
  },
  bubbleTime: {
    fontSize: 10,
    fontFamily: typography.fontRegular,
  },

  // ── Reactions ─────────────────────────────────────────────────────────────────
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 0.5,
  },
  reactionEmoji: { fontSize: 14 },

  // ── Input bar ─────────────────────────────────────────────────────────────────
  inputOuter: {
    borderTopWidth: 1,
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  editBannerText: {
    fontSize: 12,
    fontFamily: typography.fontMedium,
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 6,
  },
  // Bare attach icon button — no circle background, matches WhatsApp
  attachIconBtn: {
    paddingHorizontal: 4,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pill-shaped input — WhatsApp style rounded text field
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    fontFamily: typography.fontRegular,
    borderWidth: 1,
    maxHeight: 120,
  },
  // Purple filled circle send button
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Unfilled mic button for empty-input state
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
})
