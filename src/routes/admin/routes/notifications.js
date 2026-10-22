import express from 'express'
import { getMessaging } from 'firebase-admin/messaging'

import pool from '@/database/postgresql/index.js'
import logger from '@/logger/index.js'
import { NOTIFICATION_TEMPLATES } from '@/constants/notifications.js'

const router = express.Router()

// POST /admin/notifications/send
router.post('/send', async (req, res) => {
  const { type, targetUserId } = req.body

  if (!type || (type !== 'SENSOR' && type !== 'FORM')) {
    return res.status(400).json({ error: "Le type de notification doit être 'SENSOR' ou 'FORM'" })
  }

  const template = NOTIFICATION_TEMPLATES[type]
  if (!template) {
    return res.status(400).json({ error: "Modèle de notification introuvable" })
  }

  const bodyText = template.body
  const titleText = template.title
  const url = type === 'FORM' ? '/(forms)' : '/(sensor)'

  const client = await pool.getClient()

  try {
    let query, params
    if (targetUserId) {
      query = `
        SELECT nt.fcm_token, nt.device_id
        FROM notifications_token nt
        JOIN devices d ON d.id = nt.device_id
        WHERE d.user_id = $1 AND d.is_active = true AND nt.fcm_token IS NOT NULL AND nt.fcm_token != ''
      `
      params = [targetUserId]
    } else {
      query = `
        SELECT nt.fcm_token, nt.device_id
        FROM notifications_token nt
        JOIN devices d ON d.id = nt.device_id
        WHERE d.user_id = $1 AND d.is_active = true AND nt.fcm_token IS NOT NULL AND nt.fcm_token != ''
      `
      params = [req.user.id]
    }

    const { rows } = await client.query(query, params)

    let successCount = 0
    let failureCount = 0

    if (rows.length > 0) {
      for (const tokenRow of rows) {
        const message = {
          data: {
            type,
            url,
            ...(template.imageUrl ? { imageUrl: template.imageUrl } : {})
          },
          notification: {
            title: titleText,
            body: bodyText,
            ...(template.imageUrl ? { imageUrl: template.imageUrl } : {})
          },
          android: {
            ttl: 12 * 60 * 60 * 1000,
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
          token: tokenRow.fcm_token,
        }

        try {
          await getMessaging().send(message)
          successCount++
        } catch (err) {
          logger.error("Error sending FCM message:", err)
          failureCount++
        }
      }
    }

    logger.info({ message: `Admin demo notification sent for user ${req.user.id}`, type, successCount, failureCount })

    return res.status(200).json({
      success: true,
      notification: {
        title: titleText,
        body: bodyText,
        type,
        url,
        channelId: template.channelId,
        imageUrl: template.imageUrl,
        color: template.color
      },
      fcm: { successCount, failureCount, totalTokens: rows.length },
      message: `Notification ${type === 'SENSOR' ? 'capteur' : 'questionnaire'} envoyée.`
    })
  } catch (err) {
    logger.error("Error in admin notification send:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
