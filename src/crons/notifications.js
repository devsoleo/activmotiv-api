import dayjs from 'dayjs'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { isUserInFormPhase } from '@/utils/phases.js'

import { sendNotificationFromTemplate } from '@/notifications/index.js'

// Envoi des rappels normaux à l'heure exacte
export const handleFormNotifications = async () => {
  const now = dayjs().tz()
  const currentTime = now.format('HH:mm:00')
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const currentDay = days[now.day()]

  const client = await pool.getClient()

  try {
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
       WHERE r.day_of_week = $1
         AND r.reminder_time = $2::time
         AND nt.fcm_token IS NOT NULL
         AND nt.fcm_token != ''`,
      [currentDay, currentTime]
    )

    for (const reminder of rows) {
      if (reminder.label !== 'FORM' && reminder.label !== 'SENSOR') continue
      if (reminder.label == 'FORM' && !isUserInFormPhase({ team: reminder.team, created_at: reminder.created_at }) && reminder.team !== 0) continue

      const url = reminder.label === 'FORM' ? '/(forms)' : '/(sensor)'

      await sendNotificationFromTemplate(client, reminder, reminder.label, url)
    }
  } catch (error) {
    logger.error(`Erreur récupération des rappels:`, error)
  } finally {
    client.release()
  }
}

// Relance questionnaire 2h après si toujours non rempli (uniquement si rappel < 11h, car limite à 13h)
export const handleFormRecallNotifications = async () => {
  const now = dayjs().tz()
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const client = await pool.getClient()

  try {
    const recallTime = now.subtract(2, 'hours')
    const recallDay = days[recallTime.day()]
    const recallReminderTime = recallTime.format('HH:mm:00')

    if (recallReminderTime >= '23:00:00') return

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
        WHERE r.label = 'FORM'
          AND r.day_of_week = $1
          AND r.reminder_time = $2::time
          AND r.reminder_time < '11:00:00'::time
          AND nt.fcm_token IS NOT NULL
          AND nt.fcm_token != ''`,
      [recallDay, recallReminderTime]
    )

    if (recallRows.length <= 0) return

    for (const reminder of recallRows) {
      if (!isUserInFormPhase({ team: reminder.team, created_at: reminder.created_at }) && reminder.team != 0) continue

      const { rows: completedRows } = await client.query(
        `SELECT COUNT(*) FROM forms WHERE user_id = $1 AND completed_at >= (CURRENT_DATE AT TIME ZONE 'Europe/Paris')`,
        [reminder.user_id])

      if (Number.parseInt(completedRows[0].count, 10) > 0) continue

      logger.info(`Envoi de la relance questionnaire 2h au user ${reminder.user_id}`)

      await sendNotificationFromTemplate(client, reminder, 'FORM_RECALL', '/(forms)')
    }
  } catch (error) {
    logger.error(`Erreur récupération des rappels:`, error)
  } finally {
    client.release()
  }
}