import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { getResourceDetail, getResourceSignedUrl } from '../../lib/academic'
import type { AcademicResource } from '../../lib/academic'
import { useTheme } from '../../lib/theme'
import { typography } from '../../lib/typography'

export default function ResourceDetailScreen() {
  const theme = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [resource, setResource] = useState<AcademicResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (id) loadResource()
  }, [id])

  const loadResource = async () => {
    setLoading(true)
    try {
      const { data, error } = await getResourceDetail(id)
      if (error) throw error
      setResource(data)
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load resource details.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!resource) return
    setDownloading(true)
    try {
      const { data: signedUrl, error } = await getResourceSignedUrl(resource)
      if (error) throw error
      if (signedUrl) {
        // Increment count locally
        setResource(prev => prev ? { ...prev, download_count: prev.download_count + 1 } : prev)
        // Open the document in WebBrowser
        await WebBrowser.openBrowserAsync(signedUrl)
      } else {
        throw new Error('No signed URL returned.')
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Could not open resource link.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
        <View style={s.centeredWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    )
  }

  if (!resource) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
        <View style={s.centeredWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.textMuted} />
          <Text style={[s.errorText, { color: theme.text }]}>Resource not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={[s.retryBtn, { backgroundColor: theme.accent }]}>
            <Text style={s.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const sizeLabel = resource.file_size_kb
    ? resource.file_size_kb >= 1024
      ? `${(resource.file_size_kb / 1024).toFixed(1)} MB`
      : `${resource.file_size_kb} KB`
    : 'Unknown size'

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border2 }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.text }]}>Resource Info</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.content}>
        <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={s.fileTypeIconContainer}>
            <Ionicons name="document-text" size={42} color={theme.accent} />
          </View>
          <Text style={[s.resourceTitle, { color: theme.text }]}>{resource.title}</Text>
          <Text style={[s.resourceMeta, { color: theme.textMuted }]}>
            {resource.file_type.toUpperCase()} · {sizeLabel}
          </Text>
        </View>

        {resource.description && (
          <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.infoLabel, { color: theme.textMuted }]}>Description</Text>
            <Text style={[s.infoValue, { color: theme.text }]}>{resource.description}</Text>
          </View>
        )}

        {resource.courses && (
          <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.infoLabel, { color: theme.textMuted }]}>Linked Course</Text>
            <Text style={[s.infoValue, { color: theme.text }]}>
              {resource.courses.code} — {resource.courses.name}
            </Text>
          </View>
        )}

        <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[s.infoLabel, { color: theme.textMuted }]}>Uploaded By</Text>
          <TouchableOpacity
            style={s.uploaderRow}
            onPress={() => router.push(`/profile/${resource.uploader_id}` as any)}>
            <Ionicons name="person-circle-outline" size={20} color={theme.accent} />
            <Text style={[s.infoValue, { color: theme.text, fontFamily: typography.fontMedium }]}>
              {resource.profiles?.full_name ?? 'Student'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[s.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[s.infoLabel, { color: theme.textMuted }]}>Stats</Text>
          <Text style={[s.infoValue, { color: theme.text }]}>
            Downloaded {resource.download_count} times
          </Text>
        </View>

        <TouchableOpacity
          style={[s.downloadBtn, { backgroundColor: theme.accent }]}
          onPress={handleDownload}
          disabled={downloading}>
          {downloading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="download" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.downloadBtnText}>Download & View File</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centeredWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, fontFamily: typography.fontRegular },
  retryBtn: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: typography.fontBold },
  content: { padding: 16, gap: 12 },
  infoCard: {
    borderRadius: 14, padding: 16, borderWidth: 0.5,
    alignItems: 'flex-start',
  },
  fileTypeIconContainer: {
    alignSelf: 'center', marginBottom: 12,
  },
  resourceTitle: { fontSize: 16, fontFamily: typography.fontBold, alignSelf: 'center', textAlign: 'center', marginBottom: 4 },
  resourceMeta: { fontSize: 12, fontFamily: typography.fontMedium, alignSelf: 'center' },
  infoLabel: { fontSize: 11, fontFamily: typography.fontSemiBold, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  infoValue: { fontSize: 13, fontFamily: typography.fontRegular, lineHeight: 18 },
  uploaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, paddingVertical: 16, marginTop: 12,
  },
  downloadBtnText: { fontSize: 15, fontFamily: typography.fontBold, color: '#fff' },
})
