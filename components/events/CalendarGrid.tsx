import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'
import type { Event } from '../../lib/events'

interface Props {
  events: Event[]
  selectedDay: string | null
  onSelectDay: (day: string | null) => void
  month: Date
  onMonthChange: (month: Date) => void
}

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function PulseDot({ color }: { color: string }) {
  const opacity = useSharedValue(0.5)
  const scale = useSharedValue(1)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      ), -1
    )
    scale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      ), -1
    )
  }, [])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View style={[style, { width: 4, height: 4, borderRadius: 2, backgroundColor: color, marginTop: 2 }]} />
  )
}

interface DayCellProps {
  day: number
  dayStr: string
  isToday: boolean
  isSelected: boolean
  hasEvent: boolean
  accent: string
  textColor: string
  mutedColor: string
  onPress: () => void
}

function DayCell({ day, isToday, isSelected, hasEvent, accent, textColor, mutedColor, onPress }: DayCellProps) {
  const scale = useSharedValue(1)
  const glowOpacity = useSharedValue(isSelected ? 1 : 0)

  useEffect(() => {
    glowOpacity.value = withTiming(isSelected ? 1 : 0, { duration: 250 })
  }, [isSelected])

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    scale.value = withSequence(
      withSpring(1.28, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 14, stiffness: 200 })
    )
    onPress()
  }

  const cellAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const glowAnim = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value * 0.85,
  }))

  return (
    <TouchableOpacity style={s.cell} onPress={handlePress} activeOpacity={0.75}>
      <Animated.View style={[s.cellInner, cellAnim]}>
        <Animated.View style={[
          s.dayCircle,
          isToday && !isSelected && { backgroundColor: `${accent}20`, borderWidth: 1, borderColor: `${accent}55` },
          isSelected && { backgroundColor: accent, shadowColor: accent, shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, elevation: 10 },
          isSelected && glowAnim,
        ]}>
          <Text style={[
            s.dayNum,
            { color: mutedColor },
            isToday && !isSelected && { color: accent, fontFamily: typography.fontSemiBold },
            isSelected && { color: '#fff', fontFamily: typography.fontBold },
            !isToday && !isSelected && hasEvent && { color: textColor },
          ]}>
            {day}
          </Text>
        </Animated.View>
        {hasEvent
          ? isSelected
            ? <View style={[s.staticDot, { backgroundColor: '#fff' }]} />
            : <PulseDot color={accent} />
          : <View style={s.dotPlaceholder} />
        }
      </Animated.View>
    </TouchableOpacity>
  )
}

interface NavBtnProps {
  onPress: () => void
  icon: 'chevron-back' | 'chevron-forward'
  accent: string
}

function NavBtn({ onPress, icon, accent }: NavBtnProps) {
  const btnScale = useSharedValue(1)

  const handlePress = () => {
    btnScale.value = withSequence(
      withSpring(0.75, { damping: 10, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 250 })
    )
    onPress()
  }

  const style = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }))

  return (
    <TouchableOpacity onPress={handlePress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Animated.View style={[s.navBtn, { borderColor: `${accent}35`, backgroundColor: `${accent}12` }, style]}>
        <Ionicons name={icon} size={15} color={accent} />
      </Animated.View>
    </TouchableOpacity>
  )
}

export default function CalendarGrid({ events, selectedDay, onSelectDay, month, onMonthChange }: Props) {
  const theme = useTheme()
  const gridOpacity = useSharedValue(1)
  const gridTranslateY = useSharedValue(0)

  const year = month.getFullYear()
  const monthIdx = month.getMonth()

  const eventDays = new Set(events.map(e => e.starts_at?.slice(0, 10)).filter(Boolean))

  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const firstDow = new Date(year, monthIdx, 1).getDay()
  const startOffset = (firstDow + 6) % 7
  const totalDays = new Date(year, monthIdx + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const rows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))

  const parts = month.toLocaleDateString('en', { month: 'long', year: 'numeric' }).split(' ')
  const monthName = parts[0].toUpperCase()
  const yearStr = parts[1]

  const animateAndChange = (dir: 1 | -1) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    gridOpacity.value = withSequence(
      withTiming(0, { duration: 130, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) })
    )
    gridTranslateY.value = withSequence(
      withTiming(-10, { duration: 130, easing: Easing.out(Easing.ease) }),
      withTiming(0, { duration: 220, easing: Easing.out(Easing.back(1.8)) })
    )
    setTimeout(() => {
      onMonthChange(new Date(year, monthIdx + dir, 1))
      onSelectDay(null)
    }, 130)
  }

  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
    transform: [{ translateY: gridTranslateY.value }],
  }))

  return (
    <View style={[s.container, { borderColor: `${theme.accent}28`, shadowColor: theme.accent, backgroundColor: theme.card }]}>
      <View style={[s.scanLine, { backgroundColor: theme.accent }]} />

      <View style={s.header}>
        <NavBtn onPress={() => animateAndChange(-1)} icon="chevron-back" accent={theme.accent} />
        <View style={s.monthLabelWrap}>
          <Text style={[s.monthName, { color: theme.text }]}>{monthName}</Text>
          <Text style={[s.yearStr, { color: theme.accent }]}>{yearStr}</Text>
        </View>
        <NavBtn onPress={() => animateAndChange(1)} icon="chevron-forward" accent={theme.accent} />
      </View>

      <View style={s.dowRow}>
        {DOW_LABELS.map((d, i) => (
          <Text key={i} style={[s.dowLabel, { color: `${theme.accent}70` }]}>{d}</Text>
        ))}
      </View>

      <View style={[s.divider, { backgroundColor: `${theme.accent}18` }]} />

      <Animated.View style={[s.grid, gridStyle]}>
        {rows.map((row, ri) => (
          <View key={ri} style={s.weekRow}>
            {row.map((day, ci) => {
              if (!day) return <View key={ci} style={s.cell} />
              const dayStr = toDateStr(year, monthIdx, day)
              return (
                <DayCell
                  key={ci}
                  day={day}
                  dayStr={dayStr}
                  isToday={dayStr === todayStr}
                  isSelected={dayStr === selectedDay}
                  hasEvent={eventDays.has(dayStr)}
                  accent={theme.accent}
                  textColor={theme.text}
                  mutedColor={theme.textMuted}
                  onPress={() => onSelectDay(dayStr === selectedDay ? null : dayStr)}
                />
              )
            })}
          </View>
        ))}
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 20, borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  scanLine: {
    height: 1.5,
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
  },
  navBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  monthLabelWrap: { alignItems: 'center' },
  monthName: {
    fontSize: 17, fontFamily: typography.fontBold,
    letterSpacing: 3,
  },
  yearStr: {
    fontSize: 10, fontFamily: typography.fontMedium,
    letterSpacing: 4, marginTop: 1,
  },
  dowRow: { flexDirection: 'row', paddingHorizontal: 10, paddingBottom: 4 },
  dowLabel: {
    flex: 1, textAlign: 'center',
    fontSize: 9, fontFamily: typography.fontSemiBold,
    letterSpacing: 1.5,
  },
  divider: { height: 1, marginHorizontal: 14, marginBottom: 4 },
  grid: { paddingHorizontal: 10, paddingBottom: 12 },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  cellInner: { alignItems: 'center' },
  dayCircle: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  dayNum: { fontSize: 12, fontFamily: typography.fontMedium },
  staticDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  dotPlaceholder: { width: 4, height: 4, marginTop: 2 },
})
