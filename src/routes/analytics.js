import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { authenticateToken } from '@/middlewares/auth.js'
import { isUserInQPhase, nextUserQPhase } from '@/utils/phases.js'

const router = express.Router()

router.get('/steppers/:type', authenticateToken, async (req, res) =>  {
  const { type } = req.params

  if (type != 'questionnaire') return res.status(200).json({})

  const client = await pool.getClient()

  try {
    const userResult = await client.query('SELECT team, created_at FROM users WHERE id = $1', [req.user.id])
    const u = userResult.rows[0]

    const nextQuestionnaireDate = nextUserQPhase(u)
    return res.status(200).json({ nextQuestionnaireDate })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/steppers', authenticateToken, async (req, res) => {
  const user = req.user

  const client = await pool.getClient()

  try {
    const userResult = await client.query('SELECT team, created_at FROM users WHERE id = $1', [user.id])
    const u = userResult.rows[0]
    const userInQuestionnairePhase = isUserInQPhase(u)
    const nextQuestionnaireDate = nextUserQPhase(u)

    const qCurrentTime = await client.query(
      `SELECT 
        EXTRACT(ISODOW FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')) AS dow,
        EXTRACT(HOUR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')) AS hour`
    )
    const currentDow = Number.parseInt(qCurrentTime.rows[0].dow)
    const currentHour = Number.parseInt(qCurrentTime.rows[0].hour)
    const currentDayIndex = currentDow - 1

    const qQuestionnaires = await client.query(
      `SELECT 
        EXTRACT(ISODOW FROM completed_at AT TIME ZONE 'Europe/Paris') AS dow,
        COUNT(*) AS count
       FROM questionnaires 
       WHERE user_id = $1 
         AND completed_at >= date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris'))
         AND completed_at < date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')) + INTERVAL '1 week'
       GROUP BY dow`,
      [user.id]
    )

    const qSensor = await client.query(
      `SELECT 
        EXTRACT(ISODOW FROM updated_at AT TIME ZONE 'Europe/Paris') AS dow,
        COUNT(*) AS count
       FROM sensor 
       WHERE user_id = $1 
         AND confirmed IS TRUE
         AND updated_at >= date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris'))
         AND updated_at < date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')) + INTERVAL '1 week'
       GROUP BY dow`,
      [user.id]
    )

    const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

    const qCompletedSet = new Set(
      qQuestionnaires.rows
        .filter(row => Number.parseInt(row.count, 10) > 0)
        .map(row => Number.parseInt(row.dow, 10) - 1)
    )

    const sCompletedSet = new Set(
      qSensor.rows
        .filter(row => Number.parseInt(row.count, 10) > 0)
        .map(row => Number.parseInt(row.dow, 10) - 1)
    )

    const questionnaires = labels.map((label, index) => {
      let status
      if (qCompletedSet.has(index)) {
        status = 'done'
      } else if (index < currentDayIndex) {
        status = 'not-done'
      } else if (index === currentDayIndex) {
        status = currentHour >= 13 ? 'not-done' : 'empty'
      } else {
        status = 'empty'
      }
      return {
        label,
        status,
        completed: status === 'done'
      }
    })

    const sensor = labels.map((label, index) => {
      let status
      if (sCompletedSet.has(index)) {
        status = 'done'
      } else if (index < currentDayIndex) {
        status = 'not-done'
      } else {
        status = 'empty'
      }
      return {
        label,
        status,
        completed: status === 'done'
      }
    })

    const questionnairesCount = questionnaires.filter(d => d.status === 'done').length
    const sensorCount = sensor.filter(d => d.status === 'done').length

    return res.status(200).json({
      questionnaires,
      sensor,
      questionnairesCount,
      sensorCount,
      isUserInQPhase: userInQuestionnairePhase,
      nextQuestionnaireDate
    })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/popup', authenticateToken, async (req, res) => {
  const user = req.user

  const client = await pool.getClient()

  try {
    // 1. Get total count and total duration of popups
    const qStats = await client.query(
      `SELECT COALESCE(COUNT(*), 0) AS amount, COALESCE(SUM(duration), 0) AS total_duration FROM popups WHERE user_id = $1`,
      [user.id]
    )
    const amount = Number.parseInt(qStats.rows[0].amount)
    const total_duration = Number.parseInt(qStats.rows[0].total_duration)

    // 2. Get daily opening count for the current week (Monday to Sunday)
    const qWeekly = await client.query(
      `SELECT 
        EXTRACT(ISODOW FROM measured_at AT TIME ZONE 'Europe/Paris') AS dow,
        COUNT(*) AS count
       FROM popups 
       WHERE user_id = $1 
         AND measured_at >= date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris'))
         AND measured_at < date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')) + INTERVAL '1 week'
       GROUP BY dow`,
      [user.id]
    )

    const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    const opening = labels.map((label, index) => ({
      label,
      value: 0
    }))

    for (const row of qWeekly.rows) {
      const dow = parseInt(row.dow, 10) // 1 = Monday, 7 = Sunday
      const index = dow - 1
      if (index >= 0 && index < 7) {
        opening[index].value = parseInt(row.count, 10)
      }
    }

    return res.status(200).json({
      amount,
      duration: total_duration,
      opening
    })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.put('/popup', authenticateToken, async (req, res) => {
  const user = req.user
  const { timestamp, images, duration } = req.body

  if (!duration) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    await client.query(`INSERT INTO popups (user_id, duration, image_top, image_bottom, measured_at) VALUES ($1, $2,  $3, $4, $5)`, [user.id, duration, images.top, images.bottom, dayjs(timestamp).toISOString()])

    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router