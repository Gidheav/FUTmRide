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
import { COLORS, FONTS } from '../../core/theme'
import type { DriverInAppAnnouncement } from '../services/inAppAnnouncement'

type Props = {
  announcement: DriverInAppAnnouncement | null
  visible: boolean
  onDismiss: () => void
}

const FALLBACK_ICON = 'campaign' as keyof typeof MaterialIcons.glyphMap

export default function InAppAnnouncementModal({ announcement, visible, onDismiss }: Props) {
  const [imageFailed, setImageFailed] = useState(false)

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
              <MaterialIcons name={iconName} size={34} color={COLORS.primary} />
            </View>
          )}

          <Text style={styles.title}>{announcement.title}</Text>
          <Text style={styles.body}>{announcement.body}</Text>

          <TouchableOpacity style={styles.ctaButton} activeOpacity={0.88} onPress={onDismiss}>
            <Text style={styles.ctaText}>{announcement.ctaLabel}</Text>
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
    backgroundColor: COLORS.surfaceContainerLowest,
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
    backgroundColor: COLORS.surfaceContainer,
    marginBottom: 16,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    ...FONTS.headlineMd,
    color: COLORS.onSurface,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    ...FONTS.bodySm,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
  },
  ctaButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaText: {
    ...FONTS.labelLg,
    color: COLORS.onPrimary,
  },
})
