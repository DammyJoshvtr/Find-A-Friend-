import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ImageBackground,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/theme'

const { width } = Dimensions.get('window')
// We'll leave a small margin on the sides so it doesn't touch the screen edges
const ITEM_WIDTH = width - 15

const MOCK_ADS = [
  {
    id: '1',
    title: '50% Off Campus Coffee',
    subtitle: 'Show your FAF app at the Student Center cafe to get half off any latte before 10 AM.',
    color: '#8b5cf6', // Violet
    icon: 'cafe',
  },
  {
    id: '2',
    title: 'Spring Tech Hackathon',
    subtitle: 'Join the CS club this weekend. Free pizza, prizes, and great networking! Register now.',
    color: '#10b981', // Emerald
    icon: 'laptop-outline',
  },
  {
    id: '3',
    title: 'Exclusive Vendor Deals',
    subtitle: 'Check out the Discover tab to find amazing local discounts just for students.',
    color: '#f59e0b', // Amber
    icon: 'pricetag',
  },
]

export default function AdCarousel() {
  const theme = useTheme()
  const flatListRef = useRef<FlatList>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Auto-scroll logic
  useEffect(() => {
    const timer = setInterval(() => {
      if (MOCK_ADS.length === 0) return

      const nextIndex = (currentIndex + 1) % MOCK_ADS.length
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      })
      setCurrentIndex(nextIndex)
    }, 5000) // Change ad every 5 seconds

    return () => clearInterval(timer)
  }, [currentIndex])

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index)
    }
  }).current

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current

  const renderItem = ({ item }: { item: typeof MOCK_ADS[0] }) => (
    <View style={[s.itemContainer, { width: ITEM_WIDTH }]}>
      <View style={[s.card, { backgroundColor: item.color }]}>
        <View style={s.content}>
          <View style={s.textContainer}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.subtitle} numberOfLines={2}>
              {item.subtitle}
            </Text>
          </View>
          <View style={s.iconContainer}>
            <Ionicons name={item.icon as any} size={32} color="#fff" />
          </View>
        </View>
      </View>
    </View>
  )

  return (
    <View style={s.container}>
      <FlatList
        ref={flatListRef}
        data={MOCK_ADS}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH + 16} // Item width + margin
        snapToAlignment="center"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      />
      {/* Pagination Dots */}
      <View style={s.pagination}>
        {MOCK_ADS.map((_, index) => (
          <View
            key={index}
            style={[
              s.dot,
              { backgroundColor: index === currentIndex ? theme.accent : theme.border },
              index === currentIndex && s.activeDot
            ]}
          />
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  itemContainer: {
    paddingHorizontal: 8,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 16,
    minHeight: 90,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
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
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    lineHeight: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
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
