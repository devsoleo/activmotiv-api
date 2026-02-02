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

      q1.rows.forEach(async (i) => {
        const { id, device_id, template } = i
        const q2 = await client.query(`SELECT fcm_token FROM devices WHERE id = $1`, [device_id])

        const { fcm_token } = q2.rows[0]

        const message = {
          notification: { title, body },
          android: {
            ttl: 12 * 60 * 60 * 1000, // 12h
            priority: 'high',
          },
          token: fcm_token
        }

        getMessaging().send(message)
          .then(async (response) => {
            console.log('Successfully sent message:', response)
            await client.query(`UPDATE notifications SET status = 'sent' WHERE id = $1`, [id])
          })
          .catch((error) => {
            console.log('Error sending message:', error)
          })
      })

    } catch (err) {
      logger.error("Error :", err)
    } finally {
      client.release()
    }
  }

  await lookForNotifications()

  cron.schedule('* * * * *', lookForNotifications)
}

