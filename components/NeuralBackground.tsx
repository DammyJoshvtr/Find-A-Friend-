/**
 * NeuralBackground.tsx
 *
 * Animated neural-network style background. Renders a deterministic set of
 * "node" dots connected by thin "line" views, all pulsing via Reanimated.
 * Intentionally avoids react-native-svg — lines are View elements rotated
 * with CSS-style transforms calculated from node coordinates.
 *
 * Props:
 *   intensity – 'light' renders more transparent elements; 'normal' (default)
 *               renders at full specified opacity values.
 *
 * Performance notes:
 *   • Node positions are memoised so they are computed once on mount.
 *   • Each node owns two shared values (opacity + scale). Lines own one
 *     (opacity). Total animated values = nodes * 2 + connections * 1.
 *     With 20 nodes / 18 connections that is ≤ 58 values — well within budget.
 *   • pointerEvents="none" so the layer never intercepts touches.
 */

import React, { useMemo, useEffect } from 'react'
import {
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeDef {
  id: number
  x: number          // 0..1 relative to screen width
  y: number          // 0..1 relative to screen height
  size: number       // diameter px
  /** base pulse period ms */
  period: number
  /** startup delay ms to desynchronise pulses */
  delay: number
  /** whether this node participates in the "neon flash" effect */
  isBeacon: boolean
}

interface ConnectionDef {
  id: number
  a: number          // index into NODES
  b: number          // index into NODES
  delay: number
}

// ---------------------------------------------------------------------------
// Static node layout — deterministic, calculated at module level
// so it never changes between renders or hot reloads.
// ---------------------------------------------------------------------------

const NODE_COUNT = 20

/**
 * Pseudo-random number generator (xorshift32) seeded at a fixed value.
 * Gives reproducible "random" positions without Math.random().
 */
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}

function buildNodes(): NodeDef[] {
  const rng = makeRng(0xdeadbeef)
  const nodes: NodeDef[] = []

  for (let i = 0; i < NODE_COUNT; i++) {
    // Keep nodes away from the very edge (5%–95%) so they don't clip
    const x = 0.05 + rng() * 0.90
    const y = 0.05 + rng() * 0.90
    const size = 4 + rng() * 4            // 4–8 px
    const period = 1800 + rng() * 1400    // 1800–3200 ms
    const delay = Math.floor(rng() * 1200)
    const isBeacon = i < 4               // first 4 nodes flash brightly

    nodes.push({ id: i, x, y, size, period, delay, isBeacon })
  }
  return nodes
}

/**
 * Build a set of connections. Two nodes are connected when the Euclidean
 * distance between their relative coords is ≤ MAX_DIST. We cap at
 * MAX_CONNECTIONS so we don't create too many animated values.
 */
const MAX_DIST = 0.28   // relative units (screen fraction)
const MAX_CONNECTIONS = 20

function buildConnections(nodes: NodeDef[]): ConnectionDef[] {
  const rng = makeRng(0xcafebabe)
  const result: ConnectionDef[] = []

  for (let a = 0; a < nodes.length && result.length < MAX_CONNECTIONS; a++) {
    for (let b = a + 1; b < nodes.length && result.length < MAX_CONNECTIONS; b++) {
      const na = nodes[a]!
      const nb = nodes[b]!
      const dx = na.x - nb.x
      const dy = na.y - nb.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= MAX_DIST) {
        result.push({
          id: result.length,
          a,
          b,
          delay: Math.floor(rng() * 1000),
        })
      }
    }
  }
  return result
}

const STATIC_NODES = buildNodes()
const STATIC_CONNECTIONS = buildConnections(STATIC_NODES)

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NodeProps {
  node: NodeDef
  screenW: number
  screenH: number
  intensityMultiplier: number
}

function Node({ node, screenW, screenH, intensityMultiplier }: NodeProps) {
  const opacity = useSharedValue(0.3)
  const scale = useSharedValue(0.85)
  // Beacon nodes get an additional fast-flash shared value
  const flashOp = useSharedValue(node.isBeacon ? 0 : 1)

  useEffect(() => {
    const half = node.period / 2

    // Gentle breathe cycle
    opacity.value = withDelay(
      node.delay,
      withRepeat(
        withSequence(
          withTiming(0.9 * intensityMultiplier, {
            duration: half,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.25 * intensityMultiplier, {
            duration: half,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      ),
    )

    scale.value = withDelay(
      node.delay,
      withRepeat(
        withSequence(
          withTiming(1.4, { duration: node.period * 0.6, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.7, { duration: node.period * 0.6, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    )

    // Beacon: periodic bright flash — quick on/off every ~4 s
    if (node.isBeacon) {
      const flashDelay = node.delay + node.id * 900
      flashOp.value = withDelay(
        flashDelay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 80, easing: Easing.out(Easing.quad) }),
            withTiming(0.6, { duration: 120, easing: Easing.in(Easing.quad) }),
            withTiming(1, { duration: 60, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) }),
            // long pause before next flash
            withTiming(0, { duration: 3600 }),
          ),
          -1,
          false,
        ),
      )
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const nodeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  const flashStyle = useAnimatedStyle(() => ({
    opacity: node.isBeacon ? flashOp.value : 0,
  }))

  const cx = node.x * screenW
  const cy = node.y * screenH
  const r = node.size / 2

  return (
    <>
      {/* Core dot */}
      <Animated.View
        style={[
          styles.node,
          {
            left: cx - r,
            top: cy - r,
            width: node.size,
            height: node.size,
            borderRadius: r,
          },
          nodeStyle,
        ]}
      />
      {/* Beacon glow halo — only rendered for beacon nodes */}
      {node.isBeacon && (
        <Animated.View
          style={[
            styles.beacon,
            {
              left: cx - node.size,
              top: cy - node.size,
              width: node.size * 2,
              height: node.size * 2,
              borderRadius: node.size,
            },
            flashStyle,
          ]}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------

interface LineProps {
  conn: ConnectionDef
  nodes: NodeDef[]
  screenW: number
  screenH: number
  intensityMultiplier: number
}

function Line({ conn, nodes, screenW, screenH, intensityMultiplier }: LineProps) {
  const opacity = useSharedValue(0.08)

  useEffect(() => {
    opacity.value = withDelay(
      conn.delay,
      withRepeat(
        withSequence(
          withTiming(0.5 * intensityMultiplier, {
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.05 * intensityMultiplier, {
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      ),
    )
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const lineStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const na = nodes[conn.a]!
  const nb = nodes[conn.b]!

  const ax = na.x * screenW
  const ay = na.y * screenH
  const bx = nb.x * screenW
  const by = nb.y * screenH

  const dx = bx - ax
  const dy = by - ay
  const length = Math.sqrt(dx * dx + dy * dy)
  // atan2 returns angle in radians; convert to degrees for rotate transform
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI

  return (
    <Animated.View
      style={[
        styles.line,
        {
          width: length,
          left: ax,
          top: ay,
          // Rotate around the left-centre origin (start of the line)
          transform: [
            { translateY: -0.5 },   // half line height upward so midpoint sits on the axis
            { rotate: `${angle}deg` },
          ],
        },
        lineStyle,
      ]}
    />
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface NeuralBackgroundProps {
  intensity?: 'light' | 'normal'
}

export default function NeuralBackground({ intensity = 'normal' }: NeuralBackgroundProps) {
  const { width: screenW, height: screenH } = useWindowDimensions()

  // Memoised so nodes/connections don't regenerate on parent re-renders
  const nodes = useMemo(() => STATIC_NODES, [])
  const connections = useMemo(() => STATIC_CONNECTIONS, [])

  const intensityMultiplier = intensity === 'light' ? 0.5 : 1

  return (
    <View
      style={styles.container}
      // Prevents this overlay from blocking any touch events
      pointerEvents="none"
    >
      {/* Connection lines rendered first (behind nodes) */}
      {connections.map((conn) => (
        <Line
          key={conn.id}
          conn={conn}
          nodes={nodes}
          screenW={screenW}
          screenH={screenH}
          intensityMultiplier={intensityMultiplier}
        />
      ))}

      {/* Node dots */}
      {nodes.map((node) => (
        <Node
          key={node.id}
          node={node}
          screenW={screenW}
          screenH={screenH}
          intensityMultiplier={intensityMultiplier}
        />
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    // pointerEvents="none" is set as a prop above (RN 0.71+ JSX attribute).
    // The StyleSheet entry is kept empty intentionally — no visual styles needed.
  },
  node: {
    position: 'absolute',
    backgroundColor: 'rgba(167,139,250,0.5)',
  },
  beacon: {
    position: 'absolute',
    backgroundColor: 'rgba(167,139,250,0.35)',
  },
  line: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(167,139,250,0.15)',
    transformOrigin: 'left center',
  },
})
