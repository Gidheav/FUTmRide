import AsyncStorage from '@react-native-async-storage/async-storage'
import api from '../../core/api'

export type DriverInAppAnnouncement = {
  campaignId: string
  title: string
  body: string
  imageUrl?: string
  iconName?: string
  ctaLabel: string
}

type AnnouncementResponse = {
  announcement?: {
    campaign_id?: string
    title?: string
    body?: string
    image_url?: string
    icon_name?: string
    cta_label?: string
  } | null
}

const SEEN_CAMPAIGN_KEY_PREFIX = '@lr_ride/driver/seen_in_app_announcement'
const ANNOUNCEMENT_FETCH_TIMEOUT_MS = 3000

const seenCampaignKey = (userId: string) => `${SEEN_CAMPAIGN_KEY_PREFIX}:${userId}`

const normalizeAnnouncement = (
  raw: AnnouncementResponse['announcement'],
): DriverInAppAnnouncement | null => {
  if (!raw?.campaign_id || !raw.title || !raw.body) return null

  return {
    campaignId: raw.campaign_id,
    title: raw.title,
    body: raw.body,
    imageUrl: raw.image_url || undefined,
    iconName: raw.icon_name || undefined,
    ctaLabel: raw.cta_label || 'Got it',
  }
}

export const getPendingInAppAnnouncement = async (
  userId: string,
): Promise<DriverInAppAnnouncement | null> => {
  try {
    const response = await api.get<AnnouncementResponse>(
      'notifications/announcements/active/',
      { timeout: ANNOUNCEMENT_FETCH_TIMEOUT_MS },
    )
    const announcement = normalizeAnnouncement(response.data?.announcement)
    if (!announcement) return null

    const seenCampaignId = await AsyncStorage.getItem(seenCampaignKey(userId))
    if (seenCampaignId === announcement.campaignId) return null

    return announcement
  } catch {
    return null
  }
}

export const markInAppAnnouncementSeen = async (
  userId: string,
  campaignId: string,
): Promise<void> => {
  await AsyncStorage.setItem(seenCampaignKey(userId), campaignId)
}
