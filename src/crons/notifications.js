import { getMessaging } from 'firebase-admin/messaging'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { NOTIFICATION_TEMPLATES } from '@/constants/notifications.js'

export const handleNotifications = async () => {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${hours}:${minutes}:00`
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const currentDay = days[now.getDay()]

  const client = await pool.getClient()

  try {
    const { rows } = await client.query(
      `SELECT 
        r.user_id, 
        r.label, 
        nt.device_id, 
        nt.fcm_token 
       FROM reminders r
       JOIN devices d ON d.user_id = r.user_id AND d.is_active = true
       JOIN notifications_token nt ON nt.device_id = d.id
       WHERE r.day_of_week = $1 
         AND r.reminder_time = $2 
         AND nt.fcm_token IS NOT NULL 
         AND nt.fcm_token != ''`,
      [currentDay, currentTime]
    )

    for (const reminder of rows) {
      const template = NOTIFICATION_TEMPLATES[reminder.label]
      if (!template) continue

      const message = {
        notification: {
          title: template.title,
          body: template.body,
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
        token: reminder.fcm_token,
      }

      try {
        await getMessaging().send(message)
        logger.info(`Notification envoyée à user`)
      } catch (error) {
        if (
          error.code === 'messaging/registration-token-not-registered' ||
          error.code === 'messaging/invalid-registration-token'
        ) {
          await client.query(
            `UPDATE notifications_token SET fcm_token = NULL WHERE device_id = $1`,
            [reminder.device_id]
          )
          logger.warn(`Token invalide supprimé`)
        } else {
          logger.error(`Erreur envoi notification`, error)
        }
      }
    }
  } catch (error) {
    logger.error(`Erreur récupération des rappels:`, error)
  } finally {
    client.release()
  }
}

export default handleNotifications
