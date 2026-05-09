import { StatusBar } from 'expo-status-bar'
import { Platform, StyleSheet, View, Text } from 'react-native'
import { useTheme } from '../lib/theme'

/**
 * Generic modal screen — used as a catch-all modal route.
 * Individual features use their own dedicated modal screens.
 */
export default function ModalScreen() {
  const theme = useTheme()

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <Text style={[s.title, { color: theme.text }]}>Modal</Text>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
})
