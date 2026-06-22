import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import { supabase } from '../../lib/supabase'

const { width } = Dimensions.get('window')
const ITEM_WIDTH = width - 15
const BANNER_HEIGHT = 140
const RESTORE_DELAY_MS = 60_000

interface Ad {
  id: string
  title: string
  subtitle: string
  color: string
  icon: string
}

export default function AdCarousel() {
  const theme = useTheme()
  const flatListRef = useRef<FlatList>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [ads, setAds] = useState<Ad[]>([])
  const isRestoringRef = useRef(false)

  // Fetch active ads from Supabase
  useEffect(() => {
    supabase
      .from('app_ads')
      .select('*')
      .eq('active', true)
      .then(({ data }: any) => {
        if (data && data.length > 0) setAds(data)
      })
  }, [])

  // Swipe gesture animation
  const dragY    = useRef(new Animated.Value(0)).current
  const maxHeight = useRef(new Animated.Value(BANNER_HEIGHT)).current
  const opacity  = useRef(new Animated.Value(1)).current

  // Bouncy upward arrow hint
  const arrowBounce = useRef(new Animated.Value(0)).current

  // Start the arrow bounce loop whenever the banner is visible
  useEffect(() => {
    if (dismissed) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowBounce, { toValue: -5, duration: 380, useNativeDriver: true }),
        Animated.spring(arrowBounce, { toValue: 0, useNativeDriver: true, bounciness: 14 }),
        Animated.delay(800),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [dismissed])

  // After 60 s, slide the banner back down
  useEffect(() => {
    if (!dismissed) return
    const timer = setTimeout(() => {
      isRestoringRef.current = true
      dragY.setValue(-BANNER_HEIGHT)
      maxHeight.setValue(BANNER_HEIGHT)
      opacity.setValue(1)
      setDismissed(false)
    }, RESTORE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [dismissed])

  // Once the component re-mounts after restore, spring dragY to 0
  useEffect(() => {
    if (!dismissed && isRestoringRef.current) {
      isRestoringRef.current = false
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 10,
        speed: 10,
      }).start()
    }
  }, [dismissed])

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(dragY,     { toValue: -BANNER_HEIGHT, duration: 220, useNativeDriver: false }),
      Animated.timing(opacity,   { toValue: 0,              duration: 180, useNativeDriver: false }),
      Animated.timing(maxHeight, { toValue: 0,              duration: 320, delay: 80, useNativeDriver: false }),
    ]).start(() => setDismissed(true))
  }

  const snapBack = () => {
    Animated.spring(dragY, { toValue: 0, useNativeDriver: false, bounciness: 8 }).start()
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) dragY.setValue(g.dy)
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -50 || g.vy < -0.6) dismiss()
        else snapBack()
      },
      onPanResponderTerminate: snapBack,
    })
  ).current

  // Auto-scroll ads
  useEffect(() => {
    if (dismissed || ads.length < 2) return
    const timer = setInterval(() => {
      const next = (currentIndex + 1) % ads.length
      flatListRef.current?.scrollToIndex({ index: next, animated: true })
      setCurrentIndex(next)
    }, 5000)
    return () => clearInterval(timer)
  }, [currentIndex, dismissed, ads.length])

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index)
  }).current

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current

  const renderItem = ({ item }: { item: Ad }) => (
    <View style={[s.itemContainer, { width: ITEM_WIDTH }]}>
      <View style={[s.card, { backgroundColor: item.color }]}>
        <View style={s.glassOverlay} />
        <View style={s.content}>
          <View style={s.textContainer}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.subtitle} numberOfLines={2}>{item.subtitle}</Text>
          </View>
          <View style={s.iconContainer}>
            <Ionicons name={item.icon as any} size={30} color="#fff" />
          </View>
        </View>
      </View>
    </View>
  )

  if (dismissed || ads.length === 0) return null

  return (
    <Animated.View
      style={[s.wrapper, { maxHeight, opacity, transform: [{ translateY: dragY }] }]}
      {...panResponder.panHandlers}
    >
      {/* Swipe-up hint: bouncy arrow + drag bar */}
      <View style={s.hintRow}>
        <Animated.View style={{ transform: [{ translateY: arrowBounce }] }}>
          <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.35)" />
        </Animated.View>
        <View style={s.swipeBar} />
        <Animated.View style={{ transform: [{ translateY: arrowBounce }] }}>
          <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.35)" />
        </Animated.View>
      </View>

      <FlatList
        ref={flatListRef}
        data={ads}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH + 16}
        snapToAlignment="center"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      />

      <View style={s.pagination}>
        {ads.map((_, index) => (
          <View
            key={index}
            style={[
              s.dot,
              { backgroundColor: index === currentIndex ? theme.accent : theme.border },
              index === currentIndex && s.activeDot,
            ]}
          />
        ))}
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  wrapper: {
    marginVertical: 8,
    overflow: 'hidden',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  swipeBar: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  itemContainer: {
    paddingHorizontal: 8,
  },
  card: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 88,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: typography.fontBold,
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: typography.fontMedium,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 16,
  },
})
