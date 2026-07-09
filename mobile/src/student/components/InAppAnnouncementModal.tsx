import { useEffect, useState } from 'react'
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { StudentInAppAnnouncement } from '../services/inAppAnnouncement'
import { useWebPage } from '../context/WebPageContext'
import LinkedText from './LinkedText'

type Props = {
  announcement: StudentInAppAnnouncement | null
  visible: boolean
  onDismiss: () => void
}

const FALLBACK_ICON = 'campaign' as keyof typeof MaterialIcons.glyphMap

export default function InAppAnnouncementModal({ announcement, visible, onDismiss }: Props) {
  const [imageFailed, setImageFailed] = useState(false)
  const { openWebPage } = useWebPage()

  const handleCta = () => {
    if (announcement?.ctaUrl) {
      openWebPage(announcement.ctaUrl, announcement.title)
    }
    onDismiss()
  }

  useEffect(() => {
    setImageFailed(false)
  }, [announcement?.campaignId])

  if (!announcement) return null

  const iconName = (
    announcement.iconName && announcement.iconName in MaterialIcons.glyphMap
      ? announcement.iconName
      : FALLBACK_ICON
  ) as keyof typeof MaterialIcons.glyphMap

  const shouldShowImage = Boolean(announcement.imageUrl && !imageFailed)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.card}>
          {shouldShowImage ? (
            <Image
              source={{ uri: announcement.imageUrl }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.iconWrap}>
              <MaterialIcons name={iconName} size={34} color="#6A1B9A" />
            </View>
          )}

          <Text style={styles.title}>{announcement.title}</Text>
          <LinkedText text={announcement.body} style={styles.body} />

          <TouchableOpacity style={styles.ctaButton} activeOpacity={0.88} onPress={handleCta}>
            <Text style={styles.ctaText} numberOfLines={1} ellipsizeMode="tail">
              {announcement.ctaLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    padding: 22,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  image: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f3f3f3',
    marginBottom: 16,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0e6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1c1c',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  ctaButton: {
    minWidth: 150,
    maxWidth: 240,
    minHeight: 46,
    alignSelf: 'center',
    borderRadius: 8,
    backgroundColor: '#6A1B9A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
})
