import { getMessaging } from 'firebase-admin/messaging'
import { NOTIFICATION_TEMPLATES } from '@/notifications/templates.js'
import logger from '@/logger/index.js'

export const sendNotificationFromTemplate = async (client, reminder, type, url) => {
  const template = NOTIFICATION_TEMPLATES[type]
  if (!template) return

  const message = {
    data: {
      type,
      url,
      ...(template.imageUrl ? { imageUrl: template.imageUrl } : {})
    },
    notification: {
      title: template.title,
      body: template.body,
      ...(template.imageUrl ? { imageUrl: template.imageUrl } : {})
    },
    android: {
      ttl: 12 * 60 * 60 * 1000, // 12h
      priority: 'high',
      notification: {
        channelId: template.channelId,
        imageUrl: template.imageUrl,
        color: template.color
      }
    },
    ...(template.imageUrl ? {
      apns: {
        payload: {
          aps: {
            'mutable-content': 1
          }
        },
        fcmOptions: {
          imageUrl: template.imageUrl
        }
      }
    } : {}),
    token: reminder.fcm_token,
  }

  try {
    await getMessaging().send(message)
    logger.info(`Notification envoyée au user ${reminder.user_id}`)
  } catch (error) {
    if (
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-registration-token'
    ) {
      await client.query(
        `UPDATE notifications_token SET fcm_token = NULL WHERE device_id = $1`,
        [reminder.device_id]
      )
      logger.warn(`Token invalide supprimé pour device ${reminder.device_id}`)
    } else {
      logger.error(`Erreur envoi notification:`, error)
    }
  }
}