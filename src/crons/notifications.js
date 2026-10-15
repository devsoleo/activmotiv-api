import dayjs from 'dayjs'
import { getMessaging } from 'firebase-admin/messaging'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { NOTIFICATION_TEMPLATES } from '@/constants/notifications.js'
import { isUserInQPhase } from '@/utils/phases.js'

const sendFcmNotification = async (client, reminder, templateKey, type, url) => {
  const template = NOTIFICATION_TEMPLATES[templateKey]
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
    logger.info(`Notification ${templisUserInQPhaseateKey} envoyée au user ${reminder.user_id}`)
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

export const handleNotifications = async () => {
  const now = dayjs().tz()
  const currentTime = now.format('HH:mm:00')
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const currentDay = days[now.day()]

  const client = await pool.getClient()

  try {
    // 1. Envoi des rappels normaux à l'heure exacte
    const { rows } = await client.query(
      `SELECT 
        r.user_id, 
        r.label, 
        u.team,
        u.created_at,
        nt.device_id, 
        nt.fcm_token 
       FROM reminders r
       JOIN users u ON u.id = r.user_id
       JOIN devices d ON d.user_id = r.user_id AND d.is_active = true
       JOIN notifications_token nt ON nt.device_id = d.id
       WHERE u.team != -1
         AND r.day_of_week = $1 
         AND r.reminder_time = $2::time 
         AND nt.fcm_token IS NOT NULL 
         AND nt.fcm_token != ''`,
      [currentDay, currentTime]
    )

    for (const reminder of rows) {
      if (reminder.label === 'QUESTIONNAIRE' && !isUserInQPhase({ team: reminder.team, created_at: reminder.created_at })) {
        continue
      }

      const url = reminder.label === 'QUESTIONNAIRE' ? '/(questionnaires)' : '/(sensor)'
      await sendFcmNotification(client, reminder, reminder.label, reminder.label, url)
    }

    // 2. Relance questionnaire 2h après si toujours non rempli (uniquement si rappel < 11h, car limite à 13h)
    const recallTime = now.subtract(2, 'hour')
    const recallDay = days[recallTime.day()]
    const recallReminderTime = recallTime.format('HH:mm:00')

    if (recallReminderTime < '11:00:00') {
      const { rows: recallRows } = await client.query(
        `SELECT 
          r.user_id, 
          r.label, 
          u.team,
          u.created_at,
          nt.device_id, 
          nt.fcm_token 
         FROM reminders r
         JOIN users u ON u.id = r.user_id
         JOIN devices d ON d.user_id = r.user_id AND d.is_active = true
         JOIN notifications_token nt ON nt.device_id = d.id
         WHERE u.team != -1
           AND r.label = 'QUESTIONNAIRE'
           AND r.day_of_week = $1 
           AND r.reminder_time = $2::time 
           AND r.reminder_time < '11:00:00'::time
           AND nt.fcm_token IS NOT NULL 
           AND nt.fcm_token != ''`,
        [recallDay, recallReminderTime]
      )

      if (recallRows.length > 0) {
        for (const reminder of recallRows) {
          if (!isUserInQPhase({ team: reminder.team, created_at: reminder.created_at })) {
            continue
          }

          const { rows: completedRows } = await client.query(
            `SELECT COUNT(*) FROM questionnaires WHERE user_id = $1 AND completed_at >= (CURRENT_DATE AT TIME ZONE 'Europe/Paris')`,
            [reminder.user_id]
          )

          if (parseInt(completedRows[0].count, 10) > 0) {
            logger.info(`User ${reminder.user_id} a déjà rempli son questionnaire aujourd'hui, pas de relance 2h.`)
            continue
          }

          logger.info(`Envoi de la relance questionnaire 2h au user ${reminder.user_id}`)
          await sendFcmNotification(client, reminder, 'QUESTIONNAIRE_RECALL', 'QUESTIONNAIRE', '/(questionnaires)')
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
