import express from 'express'
import dayjs from 'dayjs'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { isUserInFormPhase, isUserInStudyPhase } from '@/utils/phases.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const client = await pool.getClient()

  try {
    const { rows: users } = await client.query(
      `SELECT id, uid, team, created_at 
       FROM users 
       WHERE team > 0 
       ORDER BY id DESC`
    )

    const alerts = []
    const now = dayjs().tz()

    // Check last 30 days (0 = today, 1..30 = past days)
    for (let i = 0; i <= 30; i++) {
      const targetDay = now.subtract(i, 'day')
      const dayStart = targetDay.startOf('day').toISOString()
      const dayEnd = targetDay.endOf('day').toISOString()
      const dayDateStr = targetDay.format('YYYY-MM-DD')
      const dateFormatted = targetDay.format('DD/MM/YYYY')

      for (const user of users) {
        if (!user.created_at) continue

        const userCreationStart = dayjs(user.created_at).tz().startOf('day')
        if (targetDay.startOf('day').isBefore(userCreationStart)) {
          continue
        }

        // Check if user was in form/popup phase
        if (isUserInFormPhase(user, targetDay)) {
          // Questionnaire alert condition matching front-end stepper:
          // Past days (i > 0) OR Today (i === 0) after 13:00 (hour >= 13)
          if (i > 0 || now.hour() >= 13) {
            const { rows: formRows } = await client.query(
              `SELECT COUNT(*) AS count 
               FROM forms 
               WHERE user_id = $1 AND completed_at >= $2 AND completed_at <= $3`,
              [user.id, dayStart, dayEnd]
            )

            if (Number.parseInt(formRows[0].count, 10) === 0) {
              alerts.push({
                id: `${user.id}-form-${dayDateStr}`,
                uid: user.uid,
                type: "Questionnaire non rempli",
                date: dateFormatted
              })
            }
          }

          // 1. Popup openings count (past days only)
          if (i > 0) {
            const { rows: popupRows } = await client.query(
              `SELECT COUNT(*) AS count 
               FROM popups 
               WHERE user_id = $1 AND measured_at >= $2 AND measured_at <= $3`,
              [user.id, dayStart, dayEnd]
            )

            if (Number.parseInt(popupRows[0].count, 10) === 0) {
              alerts.push({
                id: `${user.id}-inactivity-${dayDateStr}`,
                uid: user.uid,
                type: "Inactivité (0 ouverture)",
                date: dateFormatted
              })
            }
          }
        }

        // 3. Sensor check during study phase (past days only)
        if (i > 0 && isUserInStudyPhase(user, targetDay)) {
          const { rows: sensorRows } = await client.query(
            `SELECT COUNT(*) AS count 
             FROM sensor 
             WHERE user_id = $1 AND day = $2`,
            [user.id, dayDateStr]
          )

          if (Number.parseInt(sensorRows[0].count, 10) === 0) {
            alerts.push({
              id: `${user.id}-sensor-${dayDateStr}`,
              uid: user.uid,
              type: "Capteur non porté",
              date: dateFormatted
            })
          }
        }
      }
    }

    return res.status(200).json({ alerts })
  } catch (err) {
    logger.error("Error fetching admin alerts:", err)
    return res.status(500).json({ error: "Erreur lors de la récupération des alertes" })
  } finally {
    client.release()
  }
})

export default router
