import cron from 'node-cron'
import admin from 'firebase-admin'
import { getMessaging } from 'firebase-admin/messaging'

import logger from '../logger/index.js'
import pool from '../database/postgresql/index.js'

const notifications_content = {
  fsus: { title: 'F-SUS', body: 'Veuillez remplir votre F-SUS.' },
  generic: { title: 'Generique', body: 'Veuillez remplir votre generic.' }
}

export const runCron = async () => {
  admin.initializeApp({
    credential: admin.credential.cert('./serviceAccountKey.json')
  })

  const lookForNotifications = async () => {
    const client = await pool.getClient()

    try {
      const q1 = await client.query("SELECT * FROM notifications WHERE publish_date >= NOW() - ('1 hour')::interval")

      q1.rows.forEach(async (i) => {
        const q2 = await client.query("SELECT notification_token FROM users WHERE id = $1", [i.user_id])

        const { notification_token } = q2.rows[0]

        const message = {
          notification: notifications_content[i.label],
          android: {
            ttl: 12 * 60 * 60 * 1000, // 12h
            priority: 'high',
          },
          token: notification_token
        }

        getMessaging().send(message)
          .then(async (response) => {
            console.log('Successfully sent message:', response)
            // await client.query("DELETE FROM notifications WHERE id = $1", [i.id])
          })
          .catch((error) => {
            console.log('Error sending message:', error)
          })
      })

    } catch (err) {
      logger.error(err)
    } finally {
      client.release()
    }
  }

  await lookForNotifications()

  cron.schedule('0 0 * * *', lookForNotifications)
}

