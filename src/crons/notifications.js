import cron from 'node-cron'
import admin from 'firebase-admin'
import { getMessaging } from 'firebase-admin/messaging'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

export const runCron = async () => {
  admin.initializeApp({ credential: admin.credential.cert('./serviceAccountKey.json') })

  const lookForNotifications = async () => {
    const client = await pool.getClient()

    try {
      const q1 = await client.query(`SELECT * FROM notifications WHERE scheduled_at <= NOW() AND status = 'pending'`)

      for (const i of q1.rows) {
        const { id, device_id, template } = i
        const { title, body } = template ?? {}

        const q2 = await client.query(`SELECT fcm_token FROM notifications_token WHERE device_id = $1`, [device_id])

        const { fcm_token } = q2.rows[0]

        const message = {
          notification: { title, body },
          android: {
            ttl: 12 * 60 * 60 * 1000, // 12h
            priority: 'high',
          },
          token: fcm_token
        }

        try {
          const response = await getMessaging().send(message)

          logger.info(`Notification ${id} envoyée :`, response)
          await client.query(`UPDATE notifications SET status = 'sent' WHERE id = $1`, [id])
        } catch (error) {
          if (
            error.code === 'messaging/registration-token-not-registered' ||
            error.code === 'messaging/invalid-registration-token'
          ) {
            await client.query(`UPDATE notifications_token SET fcm_token = NULL WHERE device_id = $1`, [device_id])
            await client.query(`UPDATE notifications SET status = 'failed' WHERE id = $1`, [id])

            logger.warn(`Token invalide supprimé pour device ${device_id}`)
          } else {
            logger.error(`Erreur :`, error)
          }
        }
      }
    } catch (err) {
      logger.error('Error :', err)
    } finally {
      client.release()
    }
  }

  await lookForNotifications()

  cron.schedule('* * * * *', lookForNotifications)
}