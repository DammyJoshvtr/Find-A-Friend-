import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.logo}>FAF</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn}>
              <Text style={styles.iconText}>🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Text style={styles.iconText}>🔍</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.greeting}>
          <Text style={styles.greetSub}>Good morning,</Text>
          <Text style={styles.greetMain}>Welcome to FAF 👋</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>People you may know</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.peopleScroll}
          contentContainerStyle={{ paddingHorizontal: 16 }}>
          {['AO', 'CB', 'FN', 'TI', 'EM'].map((initials, i) => (
            <TouchableOpacity key={i} style={styles.personCard}>
              <View style={styles.personAvatar}>
                <Text style={styles.personInitials}>{initials}</Text>
              </View>
              <Text style={styles.personName}>
                {['Aisha', 'Chidi', 'Fatima', 'Tobi', 'Emeka'][i]}
              </Text>
              <Text style={styles.personMatch}>
                {[94, 88, 82, 79, 75][i]}% match
              </Text>
              <View style={styles.connectBtn}>
                <Text style={styles.connectText}>+ Add</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Campus feed</Text>
        </View>

        <View style={styles.feedCard}>
          <View style={styles.feedHeader}>
            <View style={styles.feedAvatar}>
              <Text style={styles.feedAvatarText}>AJ</Text>
            </View>
            <View>
              <Text style={styles.feedName}>Adaeze Johnson</Text>
              <Text style={styles.feedTime}>2 min ago · Computer Science</Text>
            </View>
          </View>
          <Text style={styles.feedBody}>
            Anyone going to the hackathon Friday? Looking for a team — I do UI/UX 🎨
          </Text>
          <View style={styles.feedTags}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>#Hackathon</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>#TeamUp</Text>
            </View>
          </View>
          <View style={styles.feedActions}>
            <Text style={styles.feedAction}>❤️ 12</Text>
            <Text style={styles.feedAction}>💬 4 replies</Text>
            <Text style={styles.feedAction}>🔗 Share</Text>
          </View>
        </View>

        <View style={styles.feedCard}>
          <View style={styles.feedHeader}>
            <View style={[styles.feedAvatar, { backgroundColor: '#1e2a20' }]}>
              <Text style={styles.feedAvatarText}>EM</Text>
            </View>
            <View>
              <Text style={styles.feedName}>Emeka M.</Text>
              <Text style={styles.feedTime}>18 min ago · Engineering</Text>
            </View>
          </View>
          <Text style={styles.feedBody}>
            Study group for Thermodynamics — SUB Room 2 tonight 7pm. Bring your notes!
          </Text>
          <View style={styles.feedTags}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>#StudyGroup</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>#Engineering</Text>
            </View>
          </View>
          <View style={styles.feedActions}>
            <Text style={styles.feedAction}>❤️ 7</Text>
            <Text style={styles.feedAction}>💬 9 replies</Text>
          </View>
        </View>

        <View style={styles.feedCard}>
          <View style={styles.feedHeader}>
            <View style={[styles.feedAvatar, { backgroundColor: '#1a2030' }]}>
              <Text style={styles.feedAvatarText}>KO</Text>
            </View>
            <View>
              <Text style={styles.feedName}>Kemi Osei</Text>
              <Text style={styles.feedTime}>1 hr ago · Law</Text>
            </View>
          </View>
          <Text style={styles.feedBody}>
            Spoken Word Night is this Wednesday at the Arts Centre — who is coming? 🎤
          </Text>
          <View style={styles.feedTags}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>#SpokenWord</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>#Events</Text>
            </View>
          </View>
          <View style={styles.feedActions}>
            <Text style={styles.feedAction}>❤️ 34</Text>
            <Text style={styles.feedAction}>💬 18 replies</Text>
            <Text style={styles.feedAction}>🔗 Share</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d14',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#a78bfa',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1c1c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
  },
  greeting: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  greetSub: {
    fontSize: 12,
    color: 'rgba(240,240,255,0.4)',
  },
  greetMain: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f0f0ff',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(240,240,255,0.6)',
  },
  seeAll: {
    fontSize: 12,
    color: '#a78bfa',
  },
  peopleScroll: {
    marginBottom: 20,
  },
  personCard: {
    width: 90,
    backgroundColor: '#1c1c2e',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2a1e40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  personInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c4b5fd',
  },
  personName: {
    fontSize: 10,
    fontWeight: '500',
    color: '#f0f0ff',
    marginBottom: 2,
  },
  personMatch: {
    fontSize: 9,
    fontWeight: '600',
    color: '#a78bfa',
    marginBottom: 6,
  },
  connectBtn: {
    width: '100%',
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: 20,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.3)',
    alignItems: 'center',
  },
  connectText: {
    fontSize: 9,
    color: '#a78bfa',
    fontWeight: '500',
  },
  feedCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#1c1c2e',
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  feedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a1e40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedAvatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  feedName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#f0f0ff',
  },
  feedTime: {
    fontSize: 10,
    color: 'rgba(240,240,255,0.35)',
  },
  feedBody: {
    fontSize: 13,
    color: 'rgba(240,240,255,0.7)',
    lineHeight: 20,
    marginBottom: 10,
  },
  feedTags: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  tag: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#a78bfa',
    fontWeight: '500',
  },
  feedActions: {
    flexDirection: 'row',
    gap: 16,
  },
  feedAction: {
    fontSize: 11,
    color: 'rgba(240,240,255,0.35)',
  },
})